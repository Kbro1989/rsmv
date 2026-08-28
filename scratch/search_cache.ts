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
    const rows = db.prepare(`SELECT KEY, DATA FROM cache`).all();
    const searchStrings = ["Body", "Skin", "Morphology", "Character Creator", "Avatar"];
    
    for (const row of rows) {
        const buf = decompress(row.DATA);
        const str = buf.toString('utf8');
        for (const s of searchStrings) {
            if (str.includes(s)) {
                console.log(`Interface ${row.KEY} contains "${s}"`);
                // Print a snippet
                const idx = str.indexOf(s);
                console.log(`  Snippet: ${str.substring(Math.max(0, idx - 20), Math.min(str.length, idx + 40)).replace(/[\x00-\x1F]/g, '.')}`);
            }
        }
    }
    db.close();
}

main().catch(console.error);
