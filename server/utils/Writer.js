export default class Writer {
    buffer;
    byteOffset;
    constructor(size) {
        this.buffer = Buffer.alloc(size);
        this.byteOffset = 0;
    }
    writeInt8(value) {
        this.buffer.writeInt8(value, this.byteOffset++);
    }
    writeInt16(value) {
        this.buffer.writeInt16LE(value, this.byteOffset);
        this.byteOffset += 2;
    }
    writeInt32(value) {
        this.buffer.writeInt32LE(value, this.byteOffset);
        this.byteOffset += 4;
    }
    writeUint8(value) {
        this.buffer.writeUInt8(value, this.byteOffset++);
    }
    writeUint16(value) {
        this.buffer.writeUint16LE(value, this.byteOffset);
        this.byteOffset += 2;
    }
    writeUint32(value) {
        this.buffer.writeUint32LE(value, this.byteOffset);
        this.byteOffset += 4;
    }
    writeDouble(value) {
        this.buffer.writeDoubleLE(value, this.byteOffset);
        this.byteOffset += 8;
    }
    writeString(value) {
        const buf = Buffer.from(value, 'utf8');
        buf.copy(this.buffer, this.byteOffset);
        this.byteOffset += buf.length;
        this.writeUint8(0);
    }
    writeString16(value) {
        for (let i = 0; i < value.length; i++)
            this.writeUint16(value.charCodeAt(i));
    }
}
