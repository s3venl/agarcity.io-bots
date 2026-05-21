import WebSocket from "ws";
import helper from "./utils/Helper.js";
import { logger } from "./utils/Logger.js";
import Reader from "./utils/Reader.js";
import Writer from "./utils/Writer.js";
export class AgarBot {
    id;
    ws;
    isAlive;
    nodesOnScreen;
    playerCells;
    proxyAgent;
    config;
    spawnInt;
    moveInt;
    playerPos;
    followMouse;
    followMouseTimeout;
    constructor(id, config) {
        this.id = id;
        this.ws = null;
        this.isAlive = false;
        this.nodesOnScreen = [];
        this.playerCells = [];
        this.proxyAgent = helper.getProxy();
        this.config = config;
        this.spawnInt = null;
        this.moveInt = null;
        this.playerPos = { x: 0, y: 0 };
        this.followMouse = false;
        this.followMouseTimeout = null;
        this.connect();
    }
    isBotMode() {
        const host = new URL(this.config.serverUrl).host;
        return host.endsWith(':8083');
    }
    getGameMode() {
        const host = new URL(this.config.serverUrl).host;
        return {
            'sa1.agarcity.io:8081': 1,
            'sa1.agarcity.io:8083': 2,
            'us1.agarcity.io:8081': 3,
            'us1.agarcity.io:8083': 4,
            'eu1.agarcity.io:8081': 6,
            'eu1.agarcity.io:8083': 7,
        }[host] ?? 1;
    }
    async connect() {
        const captchaTicket = await helper.getCaptchaTicket(this.getGameMode());
        if (!captchaTicket) {
            logger.warn('Failed to get captcha ticket');
            return null;
        }
        const url = new URL(this.config.serverUrl);
        url.searchParams.set('captchaTicket', captchaTicket);
        url.searchParams.set('partyCode', '');
        const serverURL = url.toString();
        logger.info(`[Bot ${this.id}]: ${captchaTicket}`);
        this.ws = new WebSocket(serverURL, {
            headers: {
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'Host': 'eu1.agarcity.io:8083',
                'Origin': 'https://agarcity.io',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
            },
            agent: this.proxyAgent,
            rejectUnauthorized: false
        });
        this.ws.binaryType = "nodebuffer";
        this.ws.onopen = this.onopen.bind(this);
        this.ws.onclose = this.onclose.bind(this);
        this.ws.onerror = (e) => {
            const reason = e instanceof Error ? e.message : 'Unknown error';
            console.error("WebSocket error:", reason);
        };
        this.ws.onmessage = this.onmessage.bind(this);
    }
    send(buffer) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(buffer);
        }
    }
    onopen() {
        var writer = new Writer(5);
        writer.writeUint8(253);
        writer.writeUint32(9);
        this.send(writer.buffer);
        var writer = new Writer(5);
        writer.writeUint8(254);
        writer.writeUint32(1);
        this.send(writer.buffer);
        this.spawnInt = setInterval(() => {
            this.spawn();
        }, 1000);
        this.moveInt = setInterval(() => {
            this.moveTo(this.playerPos.x, this.playerPos.y);
        }, 50);
    }
    onclose(e) {
        const reason = e.reason;
        if (reason.length > 0) {
            logger.info(`[Bot ${this.id}] Disconnected: ${reason}`);
        }
        if (this.moveInt)
            clearInterval(this.moveInt);
        if (this.spawnInt)
            clearInterval(this.spawnInt);
    }
    onmessage({ data }) {
        this.handleMessage(data);
    }
    handleMessage(buffer) {
        const reader = new Reader(buffer);
        const opcode = reader.readUint8();
        switch (opcode) {
            case 16:
                // this.updateNodes(reader);
                break;
        }
    }
    moveTo(x, y) {
        const writer = new Writer(9);
        writer.writeUint8(16);
        writer.writeInt32(x);
        writer.writeInt32(y);
        this.send(writer.buffer);
    }
    split() {
        this.send(Buffer.from([17]));
        this.send(Buffer.from([22])); // bots mode split
    }
    eject() {
        this.send(Buffer.from([21]));
        this.send(Buffer.from([23])); // bots mode eject
    }
    setEmoji(emoji) {
        const data = {
            action: "setEmoji",
            emoji: emoji
        };
        const writer = new Writer(2 * JSON.stringify(data).length + 2);
        writer.writeUint8(100);
        writer.writeUint8(0);
        writer.writeString(JSON.stringify(data));
        this.send(writer.buffer);
    }
    sendChat(message) {
        const writer = new Writer(4 * message.length);
        writer.writeUint8(99);
        writer.writeUint8(0);
        writer.writeString(message);
        this.send(writer.buffer);
    }
    spawn() {
        const playerName = this.config.botName;
        const skin = ''; // 345 venus skin id;
        const formattedName = `${skin ? `<${skin}>` : ''}${playerName}`;
        const badge = '';
        const partyCode = '';
        const clan = '';
        const spawnName = `${formattedName}ǂ${badge}ǂ${partyCode}ǂ${clan}`;
        const botData = `${skin}ǂ${playerName}ǂ${badge}ǂ${clan}`;
        const size = 1 +
            Buffer.byteLength(spawnName, 'utf8') + 1 +
            Buffer.byteLength(botData, 'utf8') + 1;
        const writer = new Writer(size);
        writer.writeUint8(0);
        writer.writeString(spawnName);
        if (this.isBotMode()) {
            writer.writeString(botData);
        }
        this.send(writer.buffer);
    }
}
