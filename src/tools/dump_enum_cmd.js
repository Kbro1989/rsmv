const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const MAJOR_ENUMS = 17;
const TARGET_ENUMS = [1, 4, 5, 33, 35, 53];

function decompress(data) {
    if (data.length < 8) return data;
    if (data.readUInt32BE(0) === 0x5a4c4201) {
        return zlib.inflateSync(data.slice(8));
    }
    return data;
}

async function dump() {
    console.log("📑 [FORENSIC] Dumping Target Command Enums...");
    const enumDb = path.resolve(CACHE_DIR, `js5-${MAJOR_ENUMS}.jcache`);
    const db = new Database(enumDb, { readonly: true });

    TARGET_ENUMS.forEach(id => {
        const row = db.prepare("SELECT DATA FROM cache WHERE KEY = ?").get(id);
        if (!row) {
            console.log(`[Enum ${id}] NOT FOUND`);
            return;
        }

        const data = decompress(row.DATA);
        console.log(`\n--- [ ENUM ${id} ] ---`);
        
        // Very basic string extraction for speed
        const strings = data.toString('utf8').split('\0');
        strings.forEach(s => {
            if (s.length > 2 && /[a-z]/i.test(s)) {
                console.log(` > ${s}`);
            }
        });
    });

    db.close();
}

dump().catch(console.error);


