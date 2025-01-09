import express, { Express, Request, Response, Application } from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import prisma from "./utils/db";

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

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  socket.emit("message", "hi");
  socket.on("message", (text) => {
    console.log(text);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to Express & TypeScript Server");
});

app.post("/createQuest", async (req: Request, res: Response) => {
  const { creatorId, question_slug, time_limit } = req.body;

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
})

app.post("/getQuests", async (req: Request, res: Response) => {  
   const { userId } = req.body;

   try {
    const data = await prisma.quest.findMany({
      where: {
        creatorId: userId,
      },
    })

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
 })

server.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
