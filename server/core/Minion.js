import { SmartBuffer } from "smart-buffer";
import WebSocket from "ws";
import packets from "./Packets.js";
import Entity from "./Entity.js";
import helper from "../utils/Helper.js";
import logger from "../utils/Logger.js";
export default class Minion {
    ws;
    isAlive;
    nodes;
    client;
    proxyAgent;
    isClosed;
    ownCells;
    moveInt;
    spawnInt;
    myCellIds;
    playerPos;
    constructor(client) {
        this.ws = null;
        this.isAlive = false;
        this.ownCells = [];
        this.myCellIds = {};
        this.nodes = [];
        this.client = client;
        this.spawnInt = null;
        this.isClosed = false;
        this.moveInt = null;
        this.playerPos = { x: 0, y: 0 };
        this.proxyAgent = helper.getProxy();
        this.connect();
    }
    isBotMode() {
        const host = new URL(this.client.serverUrl).host;
        return host.endsWith(':8083');
    }
    getGameMode() {
        const host = new URL(this.client.serverUrl).host;
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
            if (!global.browserFinished)
                logger.warn('Failed to get captcha ticket');
            return null;
        }
        const url = new URL(this.client.serverUrl);
        url.searchParams.set('captchaTicket', captchaTicket);
        url.searchParams.set('partyCode', ''); // remove this if you want bots to join your party
        const serverURL = url.toString();
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
        this.ws.onmessage = this.onmessage.bind(this);
    }
    send(buffer) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(buffer);
        }
    }
    onopen() {
        this.send(packets.protocolVersion());
        this.send(packets.clientVersion());
        this.spawnInt = setInterval(() => {
            this.send(packets.spawn(this.client.botName, this.isBotMode()));
        }, 1000);
        this.moveInt = setInterval(() => this.move(), 50);
    }
    onclose(e) {
        const reason = e.reason;
        if (reason.length > 0) {
            logger.info(`Disconnected: ${reason}`);
        }
        this.isClosed = true;
        if (this.moveInt)
            clearInterval(this.moveInt);
        if (this.spawnInt)
            clearInterval(this.spawnInt);
    }
    onmessage({ data }) {
        this.handleMessage(data);
    }
    handleMessage(buffer) {
        const reader = SmartBuffer.fromBuffer(buffer);
        const opcode = reader.readUInt8();
        switch (opcode) {
            case 16:
                this.updateNodes(reader);
                break;
            case 18:
                this.ownCells = [];
                break;
        }
    }
    updateNodes(reader) {
        try {
            this.parseEatRecords(reader);
            this.parseCells(reader);
            this.parseRemoveRecords(reader);
        }
        catch (err) {
            console.warn("[WARN] Failed to update nodes:", err);
        }
    }
    parseEatRecords(reader) {
        const eatRecordLength = reader.readUInt16LE();
        for (let i = 0; i < eatRecordLength; i++) {
            const eaterId = reader.readUInt32LE();
            const eatenId = reader.readUInt32LE();
            const eater = this.nodes[eaterId];
            const eaten = this.nodes[eatenId];
            if (!eater)
                continue;
            if (!eaten)
                continue;
            eaten.dead = true;
            eaten.eatenBy = eaterId;
            eaten.destroy(this);
        }
    }
    parseCells(reader) {
        while (true) {
            const id = reader.readUInt32LE();
            if (id === 0)
                break;
            const controlFlag = reader.readUInt8();
            const updated = !!(controlFlag & 32);
            let celltype;
            if (controlFlag & 2) {
                celltype = 1; // food
            }
            else if (controlFlag & 1) {
                celltype = 0; // player
            }
            else if (controlFlag & 4) {
                celltype = 2; // virus
            }
            else if (controlFlag & 8) {
                celltype = 3; // ejected
            }
            else if (controlFlag & 16) {
                celltype = 4; // motherFood
            }
            else {
                if (!(controlFlag & 64)) {
                    throw new Error(`Bad celltype: controlFlag=${controlFlag}, id=${id}`);
                }
                celltype = 5;
            }
            const entity = this.nodes[id];
            if (updated && entity == null) {
                throw new Error(`Update packet for unknown cell: id=${id}, cellType=${celltype}`);
            }
            switch (celltype) {
                case 0:
                    this.parsePlayerCell(id, reader, entity, updated);
                    break;
                case 1:
                    this.parseFood(id, reader, entity, updated, controlFlag);
                    break;
                case 2:
                    this.parseVirus(id, reader, entity, updated);
                    break;
                case 3:
                    this.parseEjected(id, reader, entity, updated);
                    break;
                case 4:
                    this.parseMotherFood(id, reader, entity, updated);
                    break;
                case 5:
                    this.parseTeleporter(id, reader, entity, updated);
                    break;
            }
        }
    }
    parseRemoveRecords(reader) {
        const removeRecordLength = reader.readUInt16LE();
        for (let i = 0; i < removeRecordLength; i++) {
            const removedEntityID = reader.readUInt32LE();
            if (this.nodes[removedEntityID])
                this.nodes[removedEntityID].destroy(this);
        }
        if (this.isAlive && this.ownCells.length === 0) {
            this.isAlive = false;
        }
    }
    parsePlayerCell(id, reader, entity, updated) {
        if (updated) {
            const x = reader.readInt16LE();
            const y = reader.readInt16LE();
            const size = reader.readUInt16LE();
            entity.x = x;
            entity.y = y;
            entity.size = size;
            entity.mass = ~~(size * size * 0.01);
            const flags = reader.readUInt8();
            const visualEvent = !!(flags & 1);
            const blockedFromAll = !!(flags & 2);
            const partyCode = !!(flags & 4);
            const emoji = !!(flags & 8);
            const userRole = !!(flags & 16);
            const interaction = !!(flags & 32);
            const freeze = !!(flags & 64);
            const rainbowEnabled = !!(flags & 128);
            const isMinionOrBot = !!(entity.isBot || entity.isMinion);
            if (visualEvent) {
                const count = reader.readUInt8();
                for (let i = 0; i < count; i++) {
                    reader.readUInt8();
                }
            }
            if (partyCode) {
                entity.partyCode = reader.readStringNT();
            }
            if (freeze) {
                reader.readUInt8();
            }
            if (!isMinionOrBot) {
                if (blockedFromAll) {
                    !!(reader.readUInt8() & 8);
                }
                if (emoji) {
                    reader.readStringNT();
                }
                if (userRole) {
                    reader.readUInt8();
                }
                if (entity.isMine && interaction) {
                    reader.readStringNT();
                }
                if (rainbowEnabled) {
                    reader.readUInt8() === 1;
                }
            }
            entity.cellType = 0;
            entity.isPlayer = true;
            return;
        }
        const x = reader.readInt16LE();
        const y = reader.readInt16LE();
        const size = reader.readUInt16LE();
        const ownerFlags = reader.readUInt16LE();
        const owner = {
            isMine: !!(ownerFlags & 1),
            isBot: !!(ownerFlags & 2),
            isMinion: !!(ownerFlags & 4),
            blockedFromAll: !!(ownerFlags & 8),
            skinPresent: !!(ownerFlags & 16),
            namePresent: !!(ownerFlags & 32),
            isFirstCell: !!(ownerFlags & 64),
            interactions: !!(ownerFlags & 128),
            clanPresent: !!(ownerFlags & 256),
            rankRainbow: !!(ownerFlags & 512),
            visualAnimations: !!(ownerFlags & 1024)
        };
        const ownerId = reader.readUInt16LE();
        let badge = null;
        let partyCode = null;
        let role = null;
        let emojiValue = null;
        let skin = null;
        let name = null;
        let clan = null;
        let colorIndex = null;
        let freezeValue = null;
        let minionOwnerId = null;
        let rainbowEnabled = owner.rankRainbow;
        if (owner.isFirstCell) {
            badge = reader.readUInt8();
            partyCode = owner.isBot ? "" : reader.readStringNT();
            const isMinionOrBot = owner.isMinion || owner.isBot;
            if (isMinionOrBot) {
                if (owner.isMinion) {
                    minionOwnerId = reader.readUInt16LE();
                }
            }
            else {
                role = reader.readUInt8();
                emojiValue = reader.readStringNT();
                if (owner.visualAnimations) {
                    const count = reader.readUInt8();
                    for (let i = 0; i < count; i++) {
                        reader.readUInt8(); // id
                        reader.readUInt16LE(); // elapsed
                    }
                }
                if (owner.isMine && owner.interactions) {
                    reader.readStringNT();
                }
            }
            skin = owner.skinPresent ? reader.readUInt16LE() : null;
            name = owner.namePresent ? reader.readStringNT() : null;
            clan = owner.clanPresent ? reader.readStringNT() : null;
            colorIndex = reader.readUInt8();
            freezeValue = reader.readUInt8();
        }
        let cell = this.nodes[ownerId];
        if (cell) {
            cell.x = x;
            cell.y = y;
            cell.size = size;
            if (name != null && cell.name !== name) {
                cell.name = name;
            }
            if (skin != null && cell.skin !== skin) {
                cell.skin = skin;
            }
            if (clan != null && cell.clan !== clan) {
                cell.clan = clan;
            }
            if (badge != null && cell.badge !== badge) {
                cell.badge = badge;
            }
            if (partyCode != null && cell.partyCode !== partyCode) {
                cell.partyCode = partyCode;
            }
        }
        else {
            cell = new Entity();
            cell.id = ownerId;
            cell.x = x;
            cell.y = y;
            cell.size = size;
            cell.cellType = 0;
            cell.isPlayer = true;
            cell.isMine = owner.isMine;
            cell.isBot = owner.isBot;
            cell.isMinion = owner.isMinion;
            this.nodes[ownerId] = cell;
        }
        if (entity) {
            entity.x = x;
            entity.y = y;
            entity.size = size;
            entity.mass = ~~entity.mass;
        }
        else {
            entity = new Entity();
            entity.id = id;
            entity.ownerId = ownerId;
            entity.x = x;
            entity.y = y;
            entity.size = size;
            entity.mass = ~~(size * size * 0.01);
            entity.cellType = 0;
            entity.isPlayer = true;
            entity.isBot = owner.isBot;
            entity.isMine = owner.isMine;
            entity.isMinion = owner.isMinion;
            entity.blockedFromAll = owner.blockedFromAll;
            if (name)
                entity.name = name;
            if (skin)
                entity.skin = skin;
            if (clan)
                entity.clan = clan;
            if (badge)
                entity.badge = badge;
            if (partyCode)
                entity.partyCode = partyCode;
            if (role != null)
                entity.userRole = role;
            if (emojiValue)
                entity.emoji = emojiValue;
            if (freezeValue != null)
                entity.freeze = freezeValue;
            if (owner.isMine) {
                this.myCellIds[id] = id;
                this.ownCells.push(entity);
                if (!this.isAlive) {
                    this.isAlive = true;
                    if (!this.client.startedBots) {
                        this.client.startedBots = true;
                        logger.info(`Bots started!`);
                    }
                }
            }
        }
        this.nodes[id] = entity;
    }
    parseFood(id, reader, entity, updated, controlFlag) {
        if (updated) {
            console.warn(`Unexpected update for food cell (id=${id}), treating as new cell`);
            return;
        }
        const x = reader.readInt16LE();
        const y = reader.readInt16LE();
        const hasCustomSize = !!(controlFlag & 128);
        const size = hasCustomSize
            ? reader.readUInt16LE()
            : -1; // idk
        const cell = new Entity();
        cell.id = id;
        cell.x = x;
        cell.y = y;
        cell.size = size;
        cell.cellType = 1;
        cell.isFood = true;
        this.nodes[id] = cell;
    }
    parseVirus(id, reader, entity, updated) {
        if (updated) {
            const flags = reader.readUInt8();
            if (flags & 2) {
                entity.x = reader.readInt16LE();
                entity.y = reader.readInt16LE();
            }
            if (flags & 4) {
                entity.size = reader.readUInt16LE();
            }
            entity.cellType = 2;
            entity.isVirus = true;
            return;
        }
        const virusType = reader.readUInt8();
        const x = reader.readInt16LE();
        const y = reader.readInt16LE();
        const size = virusType === 1
            ? -1
            : reader.readUInt16LE();
        const cell = new Entity();
        cell.id = id;
        cell.x = x;
        cell.y = y;
        cell.size = size;
        cell.cellType = 2;
        cell.virusType = virusType;
        cell.isVirus = true;
        this.nodes[id] = cell;
    }
    parseEjected(id, reader, entity, updated) {
        if (updated) {
            entity.x = reader.readInt16LE();
            entity.y = reader.readInt16LE();
            entity.cellType = 3;
            // entity.isEjected = true;
            return;
        }
        const x = reader.readInt16LE();
        const y = reader.readInt16LE();
        const size = -1;
        const colorIndex = reader.readUInt8();
        const cell = new Entity();
        cell.id = id;
        cell.x = x;
        cell.y = y;
        cell.size = size;
        cell.cellType = 3;
        // cell.colorIndex = colorIndex;
        // cell.isEjected = true;
        this.nodes[id] = cell;
    }
    parseMotherFood(id, reader, entity, updated) {
        if (updated) {
            entity.x = reader.readInt16LE();
            entity.y = reader.readInt16LE();
            entity.cellType = 4;
            entity.isFood = true;
            // entity.isMotherFood = true;
            return;
        }
        const x = reader.readInt16LE();
        const y = reader.readInt16LE();
        const size = -1;
        const cell = new Entity();
        cell.id = id;
        cell.x = x;
        cell.y = y;
        cell.size = size;
        cell.cellType = 4;
        cell.isFood = true;
        // cell.isMotherFood = true;
        this.nodes[id] = cell;
    }
    parseTeleporter(id, reader, entity, updated) {
        if (updated) {
            return;
        }
        const x = reader.readInt16LE();
        const y = reader.readInt16LE();
        const size = -1;
        const cell = new Entity();
        cell.id = id;
        cell.x = x;
        cell.y = y;
        cell.size = size;
        cell.cellType = 5;
        // cell.isTeleporter = true;
        this.nodes[id] = cell;
    }
    move() {
        const bot = {
            x: 0,
            y: 0,
            size: 0,
        };
        if (!this.isAlive)
            return;
        const nodes = this.ownCells;
        for (const cell of nodes) {
            bot.x += cell.x;
            bot.y += cell.y;
            bot.size += cell.size;
        }
        bot.x /= nodes.length;
        bot.y /= nodes.length;
        bot.size /= nodes.length;
        const nearestFood = this.nearestEntity('isFood', bot.x, bot.y);
        const nearestPlayer = this.nearestPlayer(bot.x, bot.y, bot.size);
        if (this.client.botMode && nearestFood.entity) {
            this.send(packets.move(nearestFood.entity.x, nearestFood.entity.y));
            return;
        }
        this.send(packets.move(this.playerPos.x, this.playerPos.y));
    }
    checkEnemies(botX, botY, botSize) {
        const enemies = [];
        for (const entity of Object.values(this.nodes)) {
            if (entity.isMine)
                continue;
            if (entity.isFood)
                continue;
            if (entity.isVirus)
                continue;
            const base = 50;
            const dx = entity.x - botX;
            const dy = entity.y - botY;
            const isThreat = entity.size > botSize * 1.15;
            const sizeRatio = entity.size / botSize;
            const distance = Math.hypot(dx, dy) - botSize - entity.size;
            const sizeFactor = Math.sqrt(entity.size / botSize);
            const threatRadius = distance < (base + sizeFactor);
            if (isThreat && threatRadius) {
                enemies.push({ dx, dy, distance, sizeRatio });
            }
        }
        return enemies;
    }
    nearestPlayer(botX, botY, botSize) {
        const vr = 450;
        const offset2ClientX = this.playerPos.x - botX;
        const offset2ClientY = this.playerPos.y - botY;
        const distanceClient = 1 + ((offset2ClientX * offset2ClientX + offset2ClientY * offset2ClientY) ** 0.5);
        let vx = offset2ClientX / distanceClient;
        let vy = offset2ClientY / distanceClient;
        const threats = this.checkEnemies(botX, botY, botSize);
        if (threats.length === 0) {
            return {
                x: this.playerPos.x,
                y: this.playerPos.y
            };
        }
        for (const { dx, dy, distance, sizeRatio } of threats) {
            const factor = -1 * sizeRatio;
            vx += ((dx / distance) * factor) / distance;
            vy += ((dy / distance) * factor) / distance;
        }
        const dist = 1 + Math.hypot(vx, vy);
        const targetX = botX + (vx / dist) * vr;
        const targetY = botY + (vy / dist) * vr;
        return { x: targetX, y: targetY };
    }
    nearestEntity(type, botX, botY) {
        let nearestEntity = null;
        let nearestDistance = Infinity;
        for (const entity of Object.values(this.nodes)) {
            let conditionMet = false;
            switch (type) {
                case 'isFood':
                    conditionMet = entity.isFood && !entity.isVirus;
                    break;
                case 'isVirus':
                    conditionMet = entity.isVirus && !entity.isFood;
                    break;
            }
            if (conditionMet) {
                const distance = this.calculateDistance(botX, botY, entity.x, entity.y);
                if (distance < nearestDistance) {
                    nearestEntity = entity;
                    nearestDistance = distance;
                }
            }
        }
        return {
            entity: nearestEntity,
            distance: nearestDistance,
        };
    }
    calculateDistance(botX, botY, targetX, targetY) {
        return Math.hypot(targetX - botX, targetY - botY);
    }
    split() {
        this.send(Buffer.from([17]));
        if (this.isBotMode()) {
            this.send(Buffer.from([22])); // bots mode split
        }
    }
    eject() {
        this.send(Buffer.from([21]));
        if (this.isBotMode()) {
            this.send(Buffer.from([23])); // bots mode eject
        }
    }
}
