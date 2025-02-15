import express, { Express, Request, Response, Application } from "express";
import dotenv from "dotenv";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import prisma from "./utils/db";
import validateSlug from "./utils/helper";
import axios from "axios";


//For env File
dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://socratic-ejbs.vercel.app", // Allow this origin
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
    // Get quests created by user
    const createdQuests = await prisma.quest.findMany({
      where: {
        creatorId: userId,
      },
      include: {
        winner: true,      // Include winner details
        Participant: true  // Include all participants
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Get quests where user is a participant
    const participatedQuests = await prisma.quest.findMany({
      where: {
        Participant: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        winner: true,      // Include winner details
        Participant: true  // Include all participants
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Combine and remove duplicates
    const allQuests = [...createdQuests];
    
    // Only add participated quests that weren't created by the user
    participatedQuests.forEach(quest => {
      if (!allQuests.some(q => q.id === quest.id)) {
        allQuests.push(quest);
      }
    });

    // Sort all quests by creation date
    allQuests.sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    );

    // participation status to each quest
    const questsWithMetadata = allQuests.map(quest => ({
      ...quest,
      isCreator: quest.creatorId === userId,
      isParticipant: quest.Participant.some(p => p.userId === userId),
      totalParticipants: quest.Participant.length,
      hasWon: quest.winnerId ? 
        quest.winner?.userId === userId : false
    }));

    res.json({
      status: 200,
      data: {
        quests: questsWithMetadata,
        summary: {
          total: questsWithMetadata.length,
          created: createdQuests.length,
          participated: participatedQuests.length,
          won: questsWithMetadata.filter(q => q.hasWon).length
        }
      }
    });

  } catch (error) {
    console.error("Error fetching quests:", error);
    res.status(500).json({ 
      status: 500, 
      message: "Error fetching quests",
      error: error instanceof Error ? error.message : "Unknown error"
    });
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

const getQuestionsQuery = (skip:number) => `
  query problemsetQuestionList {
    problemsetQuestionList: questionList(
      categorySlug: ""
      limit: 10
      skip: ${skip}
      filters: {}
    ) {
      total: totalNum
      questions: data {
        questionId
        title
        titleSlug
        difficulty
        acRate
        status
        frontendQuestionId: questionFrontendId
        isPaidOnly
      }
    }
  }
`;


// Function to get daily offset based on date
const getDailyOffset = () => {
  const today = new Date();
  // Create a date string in YYYYMMDD format
  const dateString = today.getFullYear() * 10000 + 
                    (today.getMonth() + 1) * 100 + 
                    today.getDate();
  
  // Use the date to generate a consistent offset for each day
  // Assuming LeetCode has around 2000 questions, we'll mod by 1990 to get offset
  // (1990 instead of 2000 to ensure we never exceed the total number of questions)
  const offset = dateString % 1990;
  
  return offset;
};

app.get('/getDailyQuestions', async (req, res) => {
  try {
    // Get the offset for today
    const skip = getDailyOffset();
    
    const response = await axios.post(
      'https://leetcode.com/graphql',
      { 
        query: getQuestionsQuery(skip)
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    );

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    const questions = response.data.data.problemsetQuestionList.questions;
    const total = response.data.data.problemsetQuestionList.total;

    // Add metadata about today's selection
    const today = new Date();
    const metadata = {
      date: today.toISOString().split('T')[0],
      offset: skip,
      total_questions: total
    };

    res.json({
      success: true,
      metadata,
      data: questions
    });

  } catch (error) {
    console.error('Error fetching daily questions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily questions',
    });
  }
});


server.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
