import WebSocket, { WebSocketServer } from "ws";
import { AgarBot } from "./AgarBot.js";
import { logger } from "./utils/Logger.js";
import Reader from "./utils/Reader.js";
import Writer from "./utils/Writer.js";
// Create Browser instance to bypass cloudflare on server start
import "../captcha/createBrowser.js";
const wss = new WebSocketServer({ port: 80 });
const config = {
    bots: [],
    maxBots: 30,
    botName: ' ',
    serverUrl: "",
    mouseX: 0,
    mouseY: 0,
    botsAi: false,
    startedBots: false,
    stoppingBots: false,
    lastEmojiTime: 0,
};
let aliveBots = 0;
let botInt;
let botTimeout;
let clientWS = null;
wss.on("listening", () => {
    logger.initialize();
    logger.info("WebSocket server is listening on ws://localhost:80");
});
wss.on("connection", (ws) => {
    clientWS = ws;
    logger.info("Client connected");
    ws.on("message", (buffer) => {
        const reader = new Reader(buffer);
        const opcode = reader.readUint8();
        switch (opcode) {
            case 0:
                config.serverUrl = reader.readString();
                startBots();
                break;
            case 1:
                stopBots();
                break;
            case 2:
                for (const bot of config.bots) {
                    if (bot.ws?.readyState === 1) {
                        bot.split();
                    }
                }
                break;
            case 3:
                for (const bot of config.bots) {
                    if (bot.ws?.readyState === 1) {
                        bot.eject();
                    }
                }
                break;
            case 4:
                config.mouseX = reader.readInt32();
                config.mouseY = reader.readInt32();
                for (const bot of config.bots) {
                    bot.playerPos = { x: config.mouseX, y: config.mouseY };
                }
                break;
            case 5: { // emoji
                if (config.bots.length === 0)
                    return;
                const now = Date.now();
                const emoji = reader.readString();
                const firstBot = config.bots[0];
                if (now - (firstBot.config.lastEmojiTime || 0) < 30000) {
                    return;
                }
                for (const bot of config.bots) {
                    bot.config.lastEmojiTime = now;
                }
                const globalDelay = 500;
                for (const bot of config.bots) {
                    if (bot.ws?.readyState !== 1)
                        continue;
                    setTimeout(() => {
                        if (bot.ws?.readyState === 1) {
                            bot.setEmoji(emoji);
                        }
                    }, globalDelay);
                }
                break;
            }
            case 6: { // chat
                const message = reader.readString();
                let delay = 0;
                const delayPerBot = 150;
                for (const bot of config.bots) {
                    if (bot.ws?.readyState === 1) {
                        setTimeout(() => {
                            if (bot.ws?.readyState === 1) {
                                bot.sendChat(message);
                            }
                        }, delay);
                        delay += delayPerBot;
                    }
                }
                break;
            }
        }
    });
});
const startBots = () => {
    if (!config.startedBots) {
        config.stoppingBots = false;
        for (let i = 0; i < config.maxBots; i++) {
            botTimeout = setTimeout(() => {
                config.bots.push(new AgarBot(i + 1, {
                    botName: `${config.botName}`,
                    serverUrl: config.serverUrl,
                    startedBots: config.startedBots,
                    lastEmojiTime: config.lastEmojiTime,
                }));
            }, 200 * i);
        }
        botInt = setInterval(() => {
            aliveBots = config.bots.filter(bot => bot.ws?.readyState === WebSocket.OPEN).length;
            sendBotCount(`${aliveBots}/${config.maxBots}`);
        }, 200);
        logger.info("Starting bots");
    }
};
const stopBots = () => {
    if (!config.stoppingBots) {
        config.stoppingBots = true;
        if (botInt)
            clearInterval(botInt);
        if (botTimeout)
            clearTimeout(botTimeout);
        for (const bot of config.bots) {
            bot.ws?.terminate();
        }
        config.bots = [];
        sendBotCount("0/" + config.maxBots);
        logger.info("Stopping bots");
    }
};
const sendBotCount = (count) => {
    if (clientWS?.readyState === WebSocket.OPEN) {
        const writer = new Writer(2 * count.length);
        writer.writeUint8(0);
        writer.writeString(count);
        clientWS.send(writer.buffer);
    }
};
