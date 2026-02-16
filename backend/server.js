import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import multer from "multer";
import fs from "fs";

// Import Services
import { createToken } from "./livekit.js";
import { VoiceAgent, vectorStore } from "./src/agent.js";

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('💥 CRITICAL ERROR (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 CRITICAL ERROR (Unhandled Rejection):', reason);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Upload Setup
const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// -----------------------------
// Routes
// -----------------------------

app.get("/getToken", async (req, res) => {
    const { identity, roomName } = req.query;
    try {
        const token = await createToken(identity || "user", roomName || "room");
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: "Failed to create token" });
    }
});

// KB Upload Endpoint (RAG)
app.post("/upload-kb", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const text = fs.readFileSync(req.file.path, "utf-8");
        await vectorStore.addDocument(text, req.file.originalname);
        fs.unlinkSync(req.file.path);

        res.json({ success: true, message: "Document ingested into Knowledge Base" });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Ingestion failed" });
    }
});

// -----------------------------
// WebSocket Orchestration
// -----------------------------

wss.on("connection", (ws) => {
    const agent = new VoiceAgent(ws);
    agent.start();
});

// -----------------------------
// Start Server
// -----------------------------
server.listen(port, () => {
    console.log(`🚀 Voice Agent Server running at http://localhost:${port}`);
});
