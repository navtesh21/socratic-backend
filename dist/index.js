"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const db_1 = __importDefault(require("./utils/db"));
const helper_1 = __importDefault(require("./utils/helper"));
const axios_1 = __importDefault(require("axios"));
//For env File
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "https://socratic-ejbs.vercel.app", // Allow this origin
        methods: ["GET", "POST"], // Allow specific HTTP methods
        credentials: true, // Allow credentials if needed
    },
});
app.use((0, cors_1.default)());
app.use(express_1.default.urlencoded({ extended: false }));
app.use(express_1.default.json());
const port = process.env.PORT || 8000;
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        next(new Error("invalid token"));
    }
    socket.room = token;
    next();
});
io.on("connection", (socket) => {
    if (!socket.room) {
        return;
    }
    socket.join(socket.room);
    console.log("a user connected", socket.id);
    socket.on("startTimer", (data) => {
        console.log(data, "from timer");
        let timeRemaining = parseInt(data) * 60;
        const timer = setInterval(() => {
            if (timeRemaining > 0) {
                timeRemaining--;
                io.to(socket.room).emit("timerUpdate", timeRemaining);
            }
            else {
                clearInterval(timer);
                io.to(socket.room).emit("timerComplete");
            }
        }, 1000);
    });
    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});
function getUsersInRoom(room) {
    const roomDetails = io.sockets.adapter.rooms.get(room); // Get the room details
    return roomDetails ? Array.from(roomDetails) : []; // Convert the Set to an array
}
app.get("/", (req, res) => {
    res.send("Welcome to Express & TypeScript Server");
});
app.post("/createQuest", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { creatorId, question_slug, time_limit } = req.body;
    const check = yield (0, helper_1.default)(question_slug);
    console.log(check);
    if (!check) {
        res.json({ status: 400, message: "Please paste a valid Url" });
        return;
    }
    try {
        const data = yield db_1.default.quest.create({
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
            const ResponseData = yield db_1.default.participant.create({
                data: {
                    questId: data.id,
                    userId: creatorId,
                },
            });
        }
        else {
            res.json({ status: 400, message: "something went wrong" });
        }
    }
    catch (error) {
        console.log(error);
        res.json({ status: 400, message: "something went wrong" });
    }
}));
app.post("/joinQuest", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, questId } = req.body;
    try {
        const response = yield db_1.default.participant.findMany({
            where: {
                questId
            },
        });
        console.log(response.length, "finding participants");
        if (response.length >= 2) {
            res.json({ status: 400, message: "Already 2 paricipants Joined" });
            return;
        }
        const data = yield db_1.default.participant.create({
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
        }
        else {
            res.json({ status: 400, message: "something went wrong" });
        }
    }
    catch (error) {
        console.log(error);
        res.json({ status: 400, message: "something went wrong" });
    }
}));
app.post("/getQuests", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.body;
    try {
        // Get quests created by user
        const createdQuests = yield db_1.default.quest.findMany({
            where: {
                creatorId: userId,
            },
            include: {
                winner: true, // Include winner details
                Participant: true // Include all participants
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        // Get quests where user is a participant
        const participatedQuests = yield db_1.default.quest.findMany({
            where: {
                Participant: {
                    some: {
                        userId: userId
                    }
                }
            },
            include: {
                winner: true, // Include winner details
                Participant: true // Include all participants
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
        allQuests.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        // participation status to each quest
        const questsWithMetadata = allQuests.map(quest => {
            var _a;
            return (Object.assign(Object.assign({}, quest), { isCreator: quest.creatorId === userId, isParticipant: quest.Participant.some(p => p.userId === userId), totalParticipants: quest.Participant.length, hasWon: quest.winnerId ?
                    ((_a = quest.winner) === null || _a === void 0 ? void 0 : _a.userId) === userId : false }));
        });
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
    }
    catch (error) {
        console.error("Error fetching quests:", error);
        res.status(500).json({
            status: 500,
            message: "Error fetching quests",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
}));
app.post("/getQuest", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { questId } = req.body;
    try {
        const data = yield db_1.default.quest.findUnique({
            where: {
                id: questId,
            },
        });
        if (data) {
            res.json({
                status: 200,
                data: data,
            });
        }
        else {
            res.json({ status: 400, message: "something went wrong" });
        }
    }
    catch (error) {
        console.log(error);
        res.json({ status: 400, message: "something went wrong" });
    }
}));
const getQuestionsQuery = (skip) => `
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
app.get('/getDailyQuestions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get the offset for today
        const skip = getDailyOffset();
        const response = yield axios_1.default.post('https://leetcode.com/graphql', {
            query: getQuestionsQuery(skip)
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
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
    }
    catch (error) {
        console.error('Error fetching daily questions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch daily questions',
        });
    }
}));
server.listen(port, () => {
    console.log(`Server is Fire at http://localhost:${port}`);
});
