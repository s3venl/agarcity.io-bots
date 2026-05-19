import WebSocket from "ws";
import Entity from "./Entity.js";
import helper from "./utils/Helper.js";
import { logger } from "./utils/Logger.js";
import Reader from "./utils/Reader.js";
import Writer from "./utils/Writer.js";
const CELL_TYPES = {
    0: 'playerCell',
    1: 'food',
    2: 'virus',
    3: 'ejected',
    4: 'motherFood',
    5: 'teleporter',
};
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
            // console.error("WebSocket error:", e);
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
            case 20:
                this.nodesOnScreen = [];
                this.playerCells = [];
                break;
            case 32:
                // this.nodesOnScreen.push(reader.readUint32());
                // if (!this.isAlive) {
                //     this.isAlive = true;
                //     if (!this.config.startedBots) {
                //         this.config.startedBots = true;
                //         console.log("Bots started");
                //     }
                // }
                break;
            default:
            // console.log(`Received unhandled opcode: ${opcode}`);
        }
    }
    updateNodes(reader) {
        try {
            // eaten records
            const eatRecordLength = reader.readUint16();
            for (let i = 0; i < eatRecordLength; i++) {
                const killerId = reader.readUint32();
                const eatenId = reader.readUint32();
                delete this.playerCells[eatenId];
                const index = this.nodesOnScreen.indexOf(eatenId);
                if (index !== -1) {
                    this.nodesOnScreen.splice(index, 1);
                }
            }
            // update / new cells
            while (true) {
                const id = reader.readUint32();
                if (id === 0)
                    break;
                const flags = reader.readUint8();
                const isUpdate = !!(flags & 32);
                let cellType;
                if (flags & 2) {
                    cellType = 1; // food
                }
                else if (flags & 1) {
                    cellType = 0; // playerCell
                }
                else if (flags & 4) {
                    cellType = 2; // virus
                }
                else if (flags & 8) {
                    cellType = 3; // ejected
                }
                else if (flags & 16) {
                    cellType = 4; // motherFood
                }
                else if (flags & 64) {
                    cellType = 5; // teleporter
                }
                else {
                    console.log("Bad celltype:", { id, flags, offset: reader.byteOffset });
                    return;
                }
                switch (cellType) {
                    case 0:
                        this.parsePlayerCell(id, reader, isUpdate, flags);
                        break;
                    case 1:
                        this.parseFood(id, reader, isUpdate, flags);
                        break;
                    case 2:
                        this.parseVirus(id, reader, isUpdate, flags);
                        break;
                    default:
                        // console.log("Unhandled cell type:", {
                        //     id,
                        //     flags,
                        //     cellType,
                        //     isUpdate,
                        //     offset: reader.byteOffset,
                        // });
                        return;
                }
            }
            // removed records
            const removeRecordLength = reader.readUint16();
            for (let i = 0; i < removeRecordLength; i++) {
                const removedEntityID = reader.readUint32();
                const index = this.nodesOnScreen.indexOf(removedEntityID);
                if (index !== -1) {
                    this.nodesOnScreen.splice(index, 1);
                }
                delete this.playerCells[removedEntityID];
            }
            if (this.isAlive && this.nodesOnScreen.length === 0) {
                this.isAlive = false;
            }
        }
        catch (err) {
            console.log("updateNodes parse failed:", err);
        }
    }
    parsePlayerCell(id, reader, isUpdate, flags) {
        let entity = this.playerCells[id];
        if (isUpdate) {
            if (!entity) {
                entity = new Entity();
                entity.id = id;
                this.playerCells[id] = entity;
            }
            entity.x = reader.readInt16();
            entity.y = reader.readInt16();
            entity.size = reader.readUint16();
            const updateMask = reader.readUint8();
            if (updateMask & 1) {
                const count = reader.readUint8();
                reader.byteOffset += count;
            }
            if (updateMask & 2) {
                reader.byteOffset += 1;
            }
            if (updateMask & 4) {
                var partyCode = reader.readString();
            }
            if (updateMask & 8) {
                var emoji = reader.readString();
            }
            if (updateMask & 16) {
                var userRole = reader.readUint8();
            }
            if (updateMask & 32) {
                var interactions = reader.readString();
            }
            if (updateMask & 64) {
                var freeze = reader.readUint8();
            }
            if (updateMask & 128) {
                var rainbowEnabled = reader.readUint8() === 1;
            }
            entity.flags = flags;
            entity.cellType = 0;
            entity.isPlayer = true;
            return;
        }
        entity = new Entity();
        entity.id = id;
        entity.x = reader.readInt16();
        entity.y = reader.readInt16();
        entity.size = reader.readUint16();
        const ownerFlags = reader.readUint16();
        const owner = {
            isMe: !!(ownerFlags & 1),
            isBot: !!(ownerFlags & 2),
            isMinion: !!(ownerFlags & 4),
            blockedFromAll: !!(ownerFlags & 8),
            skinPresent: !!(ownerFlags & 16),
            namePresent: !!(ownerFlags & 32),
            isFirstCell: !!(ownerFlags & 64),
            interactions: !!(ownerFlags & 128),
            clanPresent: !!(ownerFlags & 256),
            rankRainbow: !!(ownerFlags & 512),
            visualAnimations: !!(ownerFlags & 1024),
        };
        var ownerId = reader.readUint16();
        if (owner.isFirstCell) {
            var badge = reader.readUint8();
            if (owner.isBot) {
                var partyCode = "";
            }
            else {
                var partyCode = reader.readString();
            }
            const isMinionOrBot = owner.isMinion || owner.isBot;
            if (isMinionOrBot) {
                if (owner.isMinion) {
                    var ownerPlayerId = reader.readUint16();
                }
            }
            else {
                var userRole = reader.readUint8();
                var emoji = reader.readString();
                if (owner.visualAnimations) {
                    const snapshotCount = reader.readUint8();
                    for (let i = 0; i < snapshotCount; i++) {
                        reader.byteOffset += 3;
                    }
                }
                if (owner.isMe && owner.interactions) {
                    var interactions = reader.readString();
                }
            }
            var skin = owner.skinPresent ? reader.readUint16() : null;
            entity.name = owner.namePresent ? reader.readString() : null;
            var clan = owner.clanPresent ? reader.readString() : null;
            var colorIndex = reader.readUint8();
            var rankRainbow = owner.rankRainbow;
            var freeze = reader.readUint8();
        }
        entity.flags = flags;
        entity.cellType = 0;
        entity.isPlayer = true;
        entity.isMe = owner.isMe;
        var isBot = owner.isBot;
        var isMinion = owner.isMinion;
        this.playerCells[id] = entity;
        if (!this.nodesOnScreen.includes(id)) {
            this.nodesOnScreen.push(id);
        }
        // console.log(this.playerCells[id]);
    }
    parseFood(id, reader, isUpdate, flags) {
        let entity = this.playerCells[id];
        if (!entity) {
            entity = new Entity();
            entity.id = id;
            this.playerCells[id] = entity;
        }
        entity.x = reader.readInt16();
        entity.y = reader.readInt16();
        entity.size = 10;
        entity.flags = flags;
        entity.cellType = 1;
        entity.isFood = true;
        if (!this.nodesOnScreen.includes(id)) {
            this.nodesOnScreen.push(id);
        }
    }
    parseVirus(id, reader, isUpdate, flags) {
        let entity = this.playerCells[id];
        if (isUpdate) {
            if (!entity) {
                entity = new Entity();
                entity.id = id;
                this.playerCells[id] = entity;
            }
            const updateMask = reader.readUint8();
            if (updateMask & 2) {
                entity.x = reader.readInt16();
                entity.y = reader.readInt16();
            }
            if (updateMask & 4) {
                entity.size = reader.readUint16();
            }
            entity.flags = flags;
            entity.cellType = 2;
            entity.isVirus = true;
            return;
        }
        entity = new Entity();
        entity.id = id;
        entity.virusType = reader.readUint8();
        entity.x = reader.readInt16();
        entity.y = reader.readInt16();
        entity.size = entity.virusType === 1
            ? 100
            : reader.readUint16();
        entity.flags = flags;
        entity.cellType = 2;
        entity.isVirus = true;
        this.playerCells[id] = entity;
        if (!this.nodesOnScreen.includes(id)) {
            this.nodesOnScreen.push(id);
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
        const skin = 345; // venus skin id;
        const formattedName = `${skin ? `<${skin}>` : ''}${playerName}`;
        const badge = '';
        const partyCode = '';
        const clan = '[XS3]';
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
