import { SmartBuffer } from "smart-buffer";
export default {
    protocolVersion: () => {
        const packet = new SmartBuffer();
        packet.writeUInt8(253);
        packet.writeUInt32LE(9);
        return packet.toBuffer();
    },
    clientVersion: () => {
        const packet = new SmartBuffer();
        packet.writeUInt8(254);
        packet.writeUInt32LE(1);
        return packet.toBuffer();
    },
    spawn: (value, botMode) => {
        const skin = ''; // 345 venus skin id;
        const clan = '';
        const badge = '';
        const partyCode = '';
        const botName = '[XS3VNL]';
        const name = `${skin ? `<${skin}>` : ''}${value}`;
        const spawn = `${name}ǂ${badge}ǂ${partyCode}ǂ${clan}`;
        const minion = `${skin}ǂ${botName}ǂ${badge}ǂ${clan}`;
        const packet = new SmartBuffer();
        packet.writeUInt8(0);
        packet.writeStringNT(spawn);
        if (botMode) {
            packet.writeStringNT(minion);
        }
        return packet.toBuffer();
    },
    move: (x, y) => {
        const packet = new SmartBuffer();
        packet.writeUInt8(16);
        packet.writeInt32LE(x);
        packet.writeInt32LE(y);
        return packet.toBuffer();
    },
    sendChat: (data) => {
        const invisible = (text) => {
            return text.split('').map(char => {
                return Math.random() < 0.3 ? char + '\u200B' : char;
            }).join('');
        };
        const rand = Math.random().toString(36).substring(2, 8).toLocaleLowerCase();
        const scrambled = invisible(data);
        const message = `[${rand}] ${scrambled}`;
        const packet = new SmartBuffer();
        packet.writeUInt8(99);
        packet.writeUInt8(0);
        packet.writeStringNT(message);
        return packet.toBuffer();
    },
    sendEmoji: (emoji) => {
        const data = {
            emoji: emoji,
            action: "setEmoji",
        };
        const packet = new SmartBuffer();
        packet.writeUInt8(100);
        packet.writeUInt8(0);
        packet.writeStringNT(JSON.stringify(data));
        return packet.toBuffer();
    }
};
