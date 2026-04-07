/**
 * 🧬 Sovereign Entity Relation Extractor (Refined for RS3 NXT)
 * 
 * RS3 NXT Definition parsing heuristics.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { inflateSync, gunzipSync } from 'zlib';

const CACHE_DIR = 'C:\\ProgramData\\Jagex\\RuneScape';

function decompress(raw: Buffer): Buffer {
    if (raw.length < 3) return raw;
    if (raw.slice(0, 3).toString() === 'ZLB') return inflateSync(raw.slice(8));
    if (raw[0] === 0x1f && raw[1] === 0x8b) return gunzipSync(raw);
    if (raw[0] === 0x78) { try { return inflateSync(raw); } catch { return raw; } }
    return raw;
}

class BufferReader {
    private buf: Buffer;
    private pos = 0;
    constructor(buf: Buffer) { this.buf = buf; }
    readByte(): number { return this.buf[this.pos++]; }
    readShort(): number { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v; }
    readInt(): number { const v = this.buf.readInt32BE(this.pos); this.pos += 4; return v; }
    readBigSmart(): number {
        if (this.pos >= this.buf.length) return 0;
        return this.buf[this.pos] < 128 ? this.readShort() : this.readInt() & 0x7FFFFFFF;
    }
    readString(): string {
        const start = this.pos;
        while (this.pos < this.buf.length && this.buf[this.pos] !== 0) this.pos++;
        const str = this.buf.toString('utf-8', start, this.pos);
        if (this.pos < this.buf.length) this.pos++;
        return str;
    }
    skip(bytes: number) { this.pos += bytes; }
    hasMore(): boolean { return this.pos < this.buf.length; }
    getPos(): number { return this.pos; }
}

function parseNpc(data: Buffer): any {
    const reader = new BufferReader(data);
    const result: any = { models: [], anims: [], name: 'Unknown' };
    
    // In RS3, the first few bytes of definition are typically configurations.
    // So many opcodes have shifted or use BigSmart.
    while (reader.hasMore()) {
        const opcode = reader.readByte();
        if (opcode === 0) break;
        
        if (opcode === 1) {
            const count = reader.readByte();
            for (let i = 0; i < count; i++) {
                result.models.push(reader.readBigSmart());
            }
        } else if (opcode === 2) {
            result.name = reader.readString();
        } else if (opcode === 12) {
            result.size = reader.readByte();
        } else if (opcode >= 13 && opcode <= 17) {
            result.anims.push(reader.readBigSmart());
        } else if (opcode === 40 || opcode === 41) {
            const count = reader.readByte();
            for (let i = 0; i < count; i++) {
                reader.skip(4); // original color, new color
            }
        } else if (opcode === 60) {
            const count = reader.readByte();
            for (let i = 0; i < count; i++) reader.readBigSmart(); // extra models
        } else if (opcode === 106 || opcode === 118) {
            reader.readBigSmart(); // varbit/varp
            reader.readBigSmart();
            let count = opcode === 118 ? reader.readBigSmart() : reader.readShort();
            for (let i = 0; i <= count; i++) reader.readBigSmart(); // morphs
        } else {
            // Cannot reliably skip unknown opcodes in RS3 without Full Definitions
            // So we just break and take what we got up to this point
            break; 
        }
    }
    return result;
}

console.log('🧬 REFINED NPC ENTITY SCAN');

const db = new Database(path.join(CACHE_DIR, 'js5-18.jcache'), { readonly: true });
const targetKeys = [50] // Hans is usually 0, KBD is 50
const rows = db.prepare('SELECT KEY, DATA FROM cache WHERE KEY IN (0, 1, 2, 50, 100) OR KEY < 10 ORDER BY KEY').all() as any[];

for (const r of rows) {
    const data = decompress(r.DATA);
    const npc = parseNpc(data);
    if (npc.name !== 'Unknown') {
        console.log(`[NPC ${r.KEY}] "${npc.name}" → Models: ${npc.models.length} Anims: ${npc.anims.length}`);
    } else {
        // Find string directly in buffer just to verify
        const strMatch = data.toString('utf-8').match(/[\x20-\x7E]{3,}/);
        console.log(`[NPC ${r.KEY}] Binary -> First string: ${strMatch ? strMatch[0] : 'none'}`);
    }
}
db.close();
