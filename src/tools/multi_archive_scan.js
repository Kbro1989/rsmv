const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const MAJOR_SCRIPTS = 12;
const MAJOR_ENUMS = 17;

function decompress(data) {
    if (data.length < 8) return data;
    if (data.readUInt32BE(0) === 0x5a4c4201) { // "ZLB"
        return zlib.inflateSync(data.slice(8));
    }
    return data;
}

async function scan() {
    console.log("🔍 [PHASE 29] Multi-Archive Forensic Sweep (Scripts + Enums)...");
    
    const commandsFound = {};

    // 1. SCAN ENUMS (Major 17)
    console.log("📑 Scanning Archive 17 (Enums)...");
    const enumDb = path.resolve(CACHE_DIR, `js5-${MAJOR_ENUMS}.jcache`);
    if (fs.existsSync(enumDb)) {
        const db = new Database(enumDb, { readonly: true });
        const rows = db.prepare("SELECT KEY, DATA FROM cache").all();
        rows.forEach(row => {
            const data = decompress(row.DATA);
            const content = data.toString('utf8');
            // Look for commands in enums
            const matches = content.match(/[a-z0-9_]{3,20}/gi);
            if (matches) {
                matches.forEach(m => {
                    const low = m.toLowerCase();
                    if (["teleport", "spawn", "reload", "setvarbit", "setvarp", "giveitem", "admin"].includes(low)) {
                        if (!commandsFound[low]) commandsFound[low] = [];
                        commandsFound[low].push(`Enum:${row.KEY}`);
                    }
                });
            }
        });
        db.close();
    }

    // 2. SCAN SCRIPTS (Major 12) - Deep String Extraction
    console.log("📜 Scanning Archive 12 (Scripts)...");
    const scriptDb = path.resolve(CACHE_DIR, `js5-${MAJOR_SCRIPTS}.jcache`);
    if (fs.existsSync(scriptDb)) {
        const db = new Database(scriptDb, { readonly: true });
        const rows = db.prepare("SELECT KEY, DATA FROM cache").all();
        rows.forEach(row => {
            const data = decompress(row.DATA);
            // RS3 scripts often have strings at the start or end
            // We'll use a broad regex for anything that looks like a console command
            const content = data.toString('utf8');
            const matches = content.match(/::[a-zA-Z0-9_]+/g);
            if (matches) {
                matches.forEach(m => {
                    const low = m.toLowerCase();
                    if (!commandsFound[low]) commandsFound[low] = [];
                    if (!commandsFound[low].includes(`Script:${row.KEY}`)) {
                        commandsFound[low].push(`Script:${row.KEY}`);
                    }
                });
            }
        });
        db.close();
    }

    console.log("\n--- [ AUTHORITATIVE DISCOVERY REGISTER ] ---");
    const sorted = Object.keys(commandsFound).sort();
    sorted.forEach(cmd => {
        console.log(`${cmd.padEnd(20)} | Sources: ${commandsFound[cmd].slice(0, 5).join(", ")}`);
    });
    console.log("--------------------------------------------\n");
}

scan().catch(console.error);

