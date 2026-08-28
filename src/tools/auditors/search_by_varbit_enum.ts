import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { inflateSync, gunzipSync } from 'zlib';

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const MAJOR_SCRIPTS = 12;

function decompress(raw: Buffer): Buffer {
    if (raw.length < 3) return raw;
    if (raw.slice(0, 3).toString() === 'ZLB') return inflateSync(raw.slice(8));
    if (raw[0] === 0x1f && raw[1] === 0x8b) return gunzipSync(raw);
    if (raw[0] === 0x78) { try { return inflateSync(raw); } catch { return raw; } }
    return raw;
}

/**
 * Operation Decode Cache: Forensic Varbit & Enum Search
 * Scans the absolute truth JS5 client script bytecode for hardcoded 32-bit integer uses.
 */
async function searchMissingLogic() {
    // Parse Target ID from CLI
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("❌ Usage: npx tsx src/tools/auditors/search_by_varbit_enum.ts <ID>");
        return;
    }
    const targetId = parseInt(args[0], 10);
    if (isNaN(targetId)) {
        console.error("❌ Invalid Target ID provided.");
        return;
    }

    const scriptDb = path.resolve(CACHE_DIR, `js5-${MAJOR_SCRIPTS}.jcache`);
    if (!fs.existsSync(scriptDb)) {
        console.error("Cache not found at", scriptDb);
        return;
    }

    const scriptBuffer = Buffer.alloc(4);
    scriptBuffer.writeInt32BE(targetId, 0);

    console.log(`📡 Scanning Archive 12 (ClientScripts) for precise 32-bit signature: 0x${scriptBuffer.toString('hex').toUpperCase()} (${targetId})...`);

    const db = new Database(scriptDb, { readonly: true });
    const rows = db.prepare("SELECT KEY, DATA FROM cache").all() as { KEY: number, DATA: Buffer }[];

    let matchCount = 0;
    const matches: number[] = [];

    for (const row of rows) {
        try {
            const data = decompress(row.DATA);
            // Mechanical byte scan for the absolute truth
            if (data.includes(scriptBuffer)) {
                matches.push(row.KEY);
                matchCount++;
            }
        } catch (e) {
            // Ignore corrupted or empty groups
        }
    }
    db.close();

    console.log("\n--- [ FORENSIC RESULTS ] ---");
    if (matchCount === 0) {
        console.log(`❌ No ClientScripts found referencing ${targetId}.`);
    } else {
        console.log(`✅ Discovered ${matchCount} ClientScript(s) governing Varbit/Enum ${targetId}!`);
        console.log(`   Script IDs: [${matches.join(', ')}]`);
        console.log(`\nNext Step: Run 'npx tsx src/cli.ts extract -m clientscript --ids ...' to decompile and prove the logic.`);
    }
    console.log("----------------------------\n");
}

searchMissingLogic().catch(console.error);


