import { GameCacheLoader } from './src/cache/sqlite.js';
import { parse } from './src/opdecoder.js';
import { cacheMajors } from './src/constants.js';

class ByteStream {
    private buffer: Buffer;
    private offset: number = 0;

    constructor(buffer: Uint8Array) {
        this.buffer = Buffer.from(buffer);
    }
    
    // Reads an unsigned byte
    readUByte(): number {
        return this.buffer.readUInt8(this.offset++);
    }
    
    // RS's readSmart algorithm (signed)
    readSmart(): number {
        if (this.offset >= this.buffer.length) return 0;
        const peek = this.buffer.readUInt8(this.offset);
        if (peek < 128) {
            return this.buffer.readUInt8(this.offset++) - 64;
        } else {
            const val = this.buffer.readUInt16BE(this.offset) - 49152;
            this.offset += 2;
            return val;
        }
    }

    // RS's readSmart2 algorithm (unsigned variant?)
    readSmart1(): number {
        if (this.offset >= this.buffer.length) return 0;
        const peek = this.buffer.readUInt8(this.offset);
        if (peek < 128) {
            return this.buffer.readUInt8(this.offset++);
        } else {
            const val = this.buffer.readUInt16BE(this.offset) - 32768;
            this.offset += 2;
            return val;
        }
    }
    
    hasMore(): boolean {
        return this.offset < this.buffer.length;
    }
    
    getOffset(): number { return this.offset; }
}

async function verifyFrames() {
    console.log('--- Decoding Frame 11546 AnimData ---');
    const cache = new GameCacheLoader('C:\\\\ProgramData\\\\Jagex\\\\RuneScape');
    
    // Get Framemap 0
    const fmIndex = await cache.getCacheIndex(cacheMajors.framemaps);
    const fmArch = await cache.getFileArchive(fmIndex[0]);
    const fmFile = fmArch.find(f => f.fileid === 0);
    const fm = parse.framemaps.read(fmFile!.buffer, cache);
    
    // Get Frame 11546 File 1
    const frIndex = await cache.getCacheIndex(cacheMajors.frames);
    const frArch = await cache.getFileArchive(frIndex[11546]);
    const frFile = frArch.find(f => f.fileid === 1);
    const fr = parse.frames.read(frFile!.buffer, cache);
    
    const stream = new ByteStream(fr.animdata);
    
    console.log(`Flags length: ${fr.flags.length}, AnimData length: ${fr.animdata.length}`);
    
    let decodedOps = 0;
    
    for (let i = 0; i < fr.flags.length; i++) {
        const flag = fr.flags[i];
        if (flag !== 0) {
            const type = fm.data[i].type;
            
            let valX = 0, valY = 0, valZ = 0;
            
            if (type === 0) { // XYZ (e.g. Translate or Scale or Rotate)
                if ((flag & 1) !== 0) valX = stream.readSmart();
                if ((flag & 2) !== 0) valY = stream.readSmart();
                if ((flag & 4) !== 0) valZ = stream.readSmart();
            } else if (type === 1 || type === 2 || type === 3) {
                if ((flag & 1) !== 0) valX = stream.readSmart();
                if ((flag & 2) !== 0) valY = stream.readSmart();
                if ((flag & 4) !== 0) valZ = stream.readSmart();
            } else if (type === 5) {
                if ((flag & 1) !== 0) valX = stream.readUByte();
            } else {
                console.log(`[!] Unknown type ${type} at idx ${i} with flag ${flag}`);
                if ((flag & 1) !== 0) valX = stream.readSmart();
                if ((flag & 2) !== 0) valY = stream.readSmart();
                if ((flag & 4) !== 0) valZ = stream.readSmart();
            }
            
            console.log(`[Idx ${i}] Type: ${type}, Flag: ${flag.toString(2).padStart(3, '0')} -> dX:${valX}, dY:${valY}, dZ:${valZ}`);
            decodedOps++;
        }
    }
    
    console.log(`Decoded ${decodedOps} operations. Bytes read: ${stream.getOffset()} / ${fr.animdata.length}`);
    cache.close();
}

verifyFrames().catch(console.error);


