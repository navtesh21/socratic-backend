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
//For env File
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*", // Allow this origin
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
        const data = yield db_1.default.quest.findMany({
            where: {
                creatorId: userId,
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
server.listen(port, () => {
    console.log(`Server is Fire at http://localhost:${port}`);
});
