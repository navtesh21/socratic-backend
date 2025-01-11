import express, { Express, Request, Response, Application } from "express";
import dotenv from "dotenv";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import prisma from "./utils/db";
import validateSlug from "./utils/helper";

//For env File
dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow this origin
    methods: ["GET", "POST"], // Allow specific HTTP methods
    credentials: true, // Allow credentials if needed
  },
});

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
const port = process.env.PORT || 8000;

interface customSocket extends Socket {
  room?: string;
}

io.use((socket: customSocket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    next(new Error("invalid token"));
  }
  socket.room = token;
  next();
});

io.on("connection", (socket: customSocket) => {
  if (!socket.room) {
    return;
  }
  socket.join(socket.room);
  
  console.log("a user connected", socket.id);
  socket.on("startTimer", (data) => {
    console.log(data,"from timer")
    let timeRemaining = parseInt(data) * 60
     
     const timer = setInterval(() => {
        if (timeRemaining > 0) {
          timeRemaining--;
          io.to(socket.room!).emit("timerUpdate", timeRemaining);
        } else {
          clearInterval(timer);
          io.to(socket.room!).emit("timerComplete");
        }
      }, 1000);
    
  });
 

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});
function getUsersInRoom(room: string): string[] {
  const roomDetails = io.sockets.adapter.rooms.get(room); // Get the room details
  return roomDetails ? Array.from(roomDetails) : []; // Convert the Set to an array
}
app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Express & TypeScript Server");
});

app.post("/createQuest", async (req: Request, res: Response) => {
  const { creatorId, question_slug, time_limit } = req.body;

  const check = await validateSlug(question_slug);
  console.log(check);
  if (!check) {
    res.json({ status: 400, message: "Please paste a valid Url" });
    return;
  }

  try {
    const data = await prisma.quest.create({
      data: {
        creatorId,
        question_slug,
        time_limit,
      },
    });

    if (data.id) {
      res.json({
        status: 200,
        message: "Quest Created Successfully",
        questId: data.id,
      });

      const ResponseData = await prisma.participant.create({
        data: {
          questId: data.id,
          userId: creatorId,
        },
      });
    } else {
      res.json({ status: 400, message: "something went wrong" });
    }
  } catch (error) {
    console.log(error);
    res.json({ status: 400, message: "something went wrong" });
  }
});

app.post("/joinQuest", async (req: Request, res: Response) => {
  const { userId, questId } = req.body;

  try {

    const response = await prisma.participant.findMany({
      where:{
        questId
      },
    
    })

    console.log(response.length,"finding participants")

    if(response.length >= 2){
      res.json({ status: 400, message: "Already 2 paricipants Joined" });
      return
    }
    const data = await prisma.participant.create({
      data: {
        userId,
        questId,
      },
    });

    if (data.id) {
      res.json({
        status: 200,
        message: "Quest Joined Successfully",
      });
    } else {
      res.json({ status: 400, message: "something went wrong" });
    }
  } catch (error) {
    console.log(error);
    res.json({ status: 400, message: "something went wrong" });
  }
});

app.post("/getQuests", async (req: Request, res: Response) => {
  const { userId } = req.body;

  try {
    const data = await prisma.quest.findMany({
      where: {
        creatorId: userId,
      },
    });

    if (data) {
      res.json({
        status: 200,
        data: data,
      });
    } else {
      res.json({ status: 400, message: "something went wrong" });
    }
  } catch (error) {
    console.log(error);
    res.json({ status: 400, message: "something went wrong" });
  }
});

app.post("/getQuest", async (req: Request, res: Response) => {
  const { questId } = req.body;
  try {
    const data = await prisma.quest.findUnique({
      where: {
        id: questId,
      },
    });
    if (data) {
      res.json({
        status: 200,
        data: data,
      });
    } else {
      res.json({ status: 400, message: "something went wrong" });
    }
  } catch (error) {
    console.log(error);
    res.json({ status: 400, message: "something went wrong" });
  }
});

server.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
