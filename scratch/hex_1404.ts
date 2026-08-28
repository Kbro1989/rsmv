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
    
    const row1404 = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(1404);
    if (row1404) {
        const buf = decompress(row1404.DATA);
        console.log(`1404 first 32 bytes: ${buf.subarray(0, 32).toString('hex')}`);
    }
    
    db.close();
}

main().catch(console.error);
