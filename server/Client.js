import { SmartBuffer } from "smart-buffer";
import WebSocket from "ws";
import packets from "./core/Packets.js";
import Minion from "./core/Minion.js";
import logger from "./utils/Logger.js";
export default class Client {
    ws;
    bots;
    clientX;
    clientY;
    botMode;
    botName;
    botAmount;
    isAlive;
    serverUrl;
    playerIds;
    countInt;
    botTimeout;
    startedBots;
    stoppedBots;
    constructor(ws) {
        this.ws = ws;
        this.bots = [];
        this.clientX = 0;
        this.clientY = 0;
        this.botName = '_XS3VNL_';
        this.botMode = false;
        this.botAmount = 35;
        this.isAlive = false;
        this.serverUrl = "";
        this.playerIds = [];
        this.countInt = null;
        this.botTimeout = [];
        this.startedBots = false;
        this.stoppedBots = false;
    }
    onMessage(buffer) {
        const reader = SmartBuffer.fromBuffer(buffer);
        const opcode = reader.readUInt8();
        switch (opcode) {
            case 0:
                this.startBots(reader);
                break;
            case 1:
                this.stopBots();
                break;
            case 2:
                for (const bot of this.bots)
                    if (bot.ws?.readyState === 1 && bot.isAlive && !this.botMode)
                        bot.split();
                break;
            case 3:
                for (const bot of this.bots)
                    if (bot.ws?.readyState === 1 && bot.isAlive && !this.botMode)
                        bot.eject();
                break;
            case 4:
                this.botMode = !!reader.readUInt8();
                break;
            case 5:
                const message = reader.readString();
                for (const bot of this.bots)
                    if (bot.ws?.readyState === 1 && bot.isAlive)
                        bot.send(packets.sendChat(message));
                break;
            case 6:
                const emoji = reader.readString();
                for (const bot of this.bots)
                    if (bot.ws?.readyState === 1 && bot.isAlive)
                        bot.send(packets.sendEmoji(emoji));
                break;
            case 10:
                this.clientX = reader.readInt32LE();
                this.clientY = reader.readInt32LE();
                for (const bot of this.bots) {
                    bot.playerPos = { x: this.clientX, y: this.clientY };
                }
                break;
        }
    }
    startBots(reader) {
        this.serverUrl = reader.readString();
        if (!this.startedBots) {
            for (let i = 0; i < this.botAmount; i++) {
                this.botTimeout.push(setTimeout(() => this.bots.push(new Minion(this)), 200 * i));
            }
            this.countInt = setInterval(() => {
                this.bots = this.bots.filter(bot => !bot.isClosed);
                const aliveBots = this.bots.filter(bot => bot.ws?.readyState === WebSocket.OPEN && bot.isAlive).length;
                this.sendCount(`${aliveBots}/${this.botAmount}`);
            }, 1000);
            logger.info(`Starting ${this.botAmount} bots!`);
        }
    }
    async stopBots() {
        if (!this.stoppedBots) {
            global.browserFinished = true;
            if (global.browser) {
                try {
                    await global.browser.close();
                }
                catch { }
            }
            if (this.countInt)
                clearInterval(this.countInt);
            for (const timeout of this.botTimeout) {
                clearTimeout(timeout);
            }
            for (const bot of this.bots) {
                bot.ws?.terminate();
            }
            this.stoppedBots = true;
            this.bots.length = 0;
            this.botTimeout.length = 0;
            this.sendCount(`Bots stopped!`);
            logger.info("Bots stopped!");
        }
    }
    sendCount(value) {
        const packet = new SmartBuffer();
        packet.writeUInt8(0);
        packet.writeStringNT(value);
        this.send(packet.toBuffer());
    }
    send(buffer) {
        if (this.ws?.readyState === WebSocket.OPEN)
            this.ws.send(buffer);
    }
}
