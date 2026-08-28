import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

function decompress(buffer) {
    if (buffer[0] === 0x5a && buffer[1] === 0x4c && buffer[2] === 0x42) { // ZLB
        return zlib.inflateSync(buffer.subarray(8));
    }
    return buffer;
}

async function main() {
    const dbPath = "C:\\ProgramData\\Jagex\\RuneScape-BETA\\js5-3.jcache";
    if (!fs.existsSync(dbPath)) {
        console.log("Major 3 DB not found at " + dbPath);
        return;
    }
    const db = new Database(dbPath, { readonly: true });
    const ids = [1404, 1922, 1929, 1946, 1947];
    for (const id of ids) {
        try {
            const row = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(id);
            if (row) {
                const buf = decompress(row.DATA);
                console.log(`Interface ${id}: first 10 bytes: ${buf.subarray(0, 10).toString('hex')}`);
            } else {
                console.log(`Interface ${id}: Not found in DB`);
            }
        } catch (e) {
            console.log(`Interface ${id}: Error: ${e.message}`);
        }
    }
    db.close();
}

main().catch(console.error);
