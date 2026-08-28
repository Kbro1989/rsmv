import Database from 'better-sqlite3';
import * as fs from 'fs';
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
    const row = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(1404);
    if (row) {
        const buf = decompress(row.DATA);
        fs.writeFileSync("scratch/1404.hex", buf.toString('hex'));
        console.log("Saved to scratch/1404.hex");
    }
    db.close();
}

main().catch(console.error);
