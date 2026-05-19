export default class Reader {
    buffer;
    byteOffset;
    constructor(buffer) {
        this.buffer = buffer;
        this.byteOffset = 0;
    }
    readInt8() {
        return this.buffer.readInt8(this.byteOffset++);
    }
    readInt16() {
        const value = this.buffer.readInt16LE(this.byteOffset);
        this.byteOffset += 2;
        return value;
    }
    readInt32() {
        const value = this.buffer.readInt32LE(this.byteOffset);
        this.byteOffset += 4;
        return value;
    }
    readUint8() {
        return this.buffer.readUint8(this.byteOffset++);
    }
    readUint16() {
        const value = this.buffer.readUInt16LE(this.byteOffset);
        this.byteOffset += 2;
        return value;
    }
    readUint32() {
        const value = this.buffer.readUInt32LE(this.byteOffset);
        this.byteOffset += 4;
        return value;
    }
    readFloat16() {
        const value = this.buffer.readUInt16LE(this.byteOffset);
        const sign = (value & 0x8000) ? -1 : 1;
        const exponent = (value >> 10) & 0x1f;
        const fraction = value & 0x03ff;
        if (exponent === 0) {
            return sign * Math.pow(2, -14) * (fraction / Math.pow(2, 10));
        }
        if (exponent === 31) {
            return fraction ? NaN : sign * Infinity;
        }
        return sign * Math.pow(2, exponent - 15) * (1 + fraction / Math.pow(2, 10));
    }
    readDouble() {
        const value = this.buffer.readDoubleLE(this.byteOffset);
        this.byteOffset += 8;
        return value;
    }
    readString() {
        let string = '';
        while (true) {
            const charCode = this.readUint8();
            if (charCode === 0)
                break;
            string += String.fromCharCode(charCode);
        }
        return string;
    }
    readString16() {
        let string = '';
        while (true) {
            const charCode = this.readUint16();
            if (charCode === 0)
                break;
            string += String.fromCharCode(charCode);
        }
        return string;
    }
    skipBytes(byte) {
        this.byteOffset += byte;
    }
}
