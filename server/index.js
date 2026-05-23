import http from "http";
import Client from "./Client.js";
import logger from "./utils/Logger.js";
import { WebSocketServer } from "ws";
await logger.initialize();
const server = http.createServer();
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
    const client = new Client(ws);
    logger.info("Client connected");
    ws.on("message", (buffer) => {
        client.onMessage(buffer);
    });
    ws.on("close", () => {
        logger.warn("Client disconnected");
        for (const bot of client.bots) {
            if (bot.ws?.readyState === 1) {
                bot.ws.terminate();
            }
        }
    });
    ws.on("error", (error) => {
        logger.warn(`WebSocket error: ${error.message}`);
    });
});
server.listen(80, () => {
    logger.info("WebSocket server is listening on ws://localhost:80");
});
