const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// Path to your RuneScape cache
const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";
const MAJOR_CLIENTSCRIPT = 12;

function decompress(data) {
    if (data.readUInt32BE(0) === 0x5a4c4201) { // "ZLB" header
        const uncompressedSize = data.readUInt32BE(4);
        return zlib.inflateSync(data.slice(8));
    }
    return data;
}

async function scan() {
    console.log("🔍 [PHASE 29] Forensic Admin Command Scan (Decompressing)...");
    const dbPath = path.resolve(CACHE_DIR, `js5-${MAJOR_CLIENTSCRIPT}.jcache`);
    
    if (!fs.existsSync(dbPath)) {
        console.error(`❌ Cache for Major ${MAJOR_CLIENTSCRIPT} not found at ${dbPath}`);
        return;
    }

    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare("SELECT KEY, DATA FROM cache").all();
    const commandsFound = {};

    console.log(`📂 Decompressing and Scanning ${rows.length} scripts...`);

    rows.forEach(row => {
        try {
            const rawData = row.DATA;
            const data = decompress(rawData);
            
            // Forensic String Extraction
            // We search for patterns like ::tele, ::item, etc.
            // In binary, strings are null-terminated or prefixed.
            const content = data.toString('utf8');
            
            // Regex to find "::" followed by word characters
            const matches = content.match(/::[a-zA-Z0-9_]+/g);
            
            if (matches) {
                matches.forEach(m => {
                    const cmd = m.toLowerCase();
                    if (!commandsFound[cmd]) commandsFound[cmd] = [];
                    if (!commandsFound[cmd].includes(row.KEY)) {
                        commandsFound[cmd].push(row.KEY);
                    }
                });
            }
        } catch (e) {
            // Skip unreadable rows
        }
    });

    console.log("\n--- [ AUTHORITATIVE ADMIN COMMAND REGISTER ] ---");
    const sorted = Object.keys(commandsFound).sort();
    sorted.forEach(cmd => {
        // Filter out noise (single characters or non-command strings)
        if (cmd.length > 3) {
            console.log(`${cmd.padEnd(25)} | Scripts: ${commandsFound[cmd].slice(0, 3).join(", ")}${commandsFound[cmd].length > 3 ? ` (+${commandsFound[cmd].length - 3} more)` : ""}`);
        }
    });
    console.log("------------------------------------------------\n");
    
    db.close();
}

scan().catch(console.error);
