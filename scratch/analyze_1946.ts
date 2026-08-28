import Database from 'better-sqlite3';
import * as zlib from 'zlib';

function decompress(buffer) {
    if (buffer[0] === 0x5a && buffer[1] === 0x4c && buffer[2] === 0x42) { // ZLB
        return zlib.inflateSync(buffer.subarray(8));
    }
    return buffer;
}

async function main() {
    const dbPath = "C:\\ProgramData\\Jagex\\RuneScape-BETA\\js5-3.jcache";
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(1946);
    if (row) {
        const buf = decompress(row.DATA);
        console.log(`Size: ${buf.length}`);
        const idx = buf.indexOf(Buffer.from([0x05, 0x03]));
        console.log(`05 03 at offset: ${idx}`);
        // Check if there are many such sequences
        let count = 0;
        let pos = 0;
        while ((pos = buf.indexOf(Buffer.from([0x05, 0x03]), pos)) !== -1) {
            count++;
            pos += 2;
        }
        console.log(`Count of 05 03: ${count}`);
    }
    db.close();
}

main().catch(console.error);
