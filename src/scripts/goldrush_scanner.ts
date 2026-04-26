import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import { decompress } from "../../tmp_rsmv_inspect/src/cache/compression.js"; // Fixed extension for node16/nodenext

// Authoritative Sovereign Substrate (Phase 43)
const CACHE_ROOT = "C:\\ProgramData\\Jagex\\RuneScape";
const JSON_DUMPS = "D:\\sovereign\\cache_pedagogy\\json_dumps";
const OUTPUT_DIR = "D:\\sovereign\\memory\\pedagogy";

async function runGoldrush() {
    console.log("🧬 SOVEREIGN GOLDRUSH FORENSIC HARNESS [PHASE 43]");
    console.log("------------------------------------------------");

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 1. Keyword Extraction from Goldrush Dumps
    const keywords = new Set(["varbit", "varp", "config", "gate", "obj", "npc", "tele", "pos"]);
    const dumpFiles = ["enums.json", "objects.json", "npcs.json", "items.json"];
    
    console.log("💰 Extracting semantic keywords from Sovereign Dumps...");
    for (const file of dumpFiles) {
        const filePath = path.join(JSON_DUMPS, file);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.name && item.name.length > 4) keywords.add(item.name.toLowerCase());
                }
            } else {
                // Enums
                for (const key in data) {
                    const entry = data[key];
                    if (entry.map) {
                        for (const mk in entry.map) {
                            const val = entry.map[mk];
                            if (typeof val === "string" && val.length > 5) keywords.add(val.toLowerCase());
                        }
                    }
                }
            }
        }
    }
    console.log(`🔥 Total Specialized Keywords: ${keywords.size}`);

    // 2. ClientScript Major 12 Scan
    const scriptCachePath = path.join(CACHE_ROOT, "js5-12.jcache");
    if (!fs.existsSync(scriptCachePath)) {
        console.error("❌ ERROR: Major 12 Cache missing at", scriptCachePath);
        return;
    }

    const db = new Database(scriptCachePath, { readonly: true });
    const keywordArray = Array.from(keywords);
    const registry: Record<string, number[]> = {};

    console.log("🦾 Scanning ClientScripts for Semantic Truth...");
    
    const rows = db.prepare("SELECT KEY, DATA FROM cache").all() as { KEY: number, DATA: Buffer }[];
    
    for (const row of rows) {
        try {
            // Unpack and decompress (NXT format: first byte is compression type)
            const decompressed = decompress(row.DATA);
            
            // Forensic String Brute-Force
            let currentStr = "";
            for (let i = 0; i < decompressed.length; i++) {
                const char = decompressed[i];
                if (char >= 32 && char <= 126) {
                    currentStr += String.fromCharCode(char);
                } else {
                    if (currentStr.length > 3) {
                        const lower = currentStr.toLowerCase();
                        
                        // Commands
                        if (lower.includes("::")) {
                            const match = lower.match(/::([a-z0-9_]+)/);
                            if (match) {
                                const tag = `cmd:${match[1]}`;
                                if (!registry[tag]) registry[tag] = [];
                                if (!registry[tag].includes(row.KEY)) registry[tag].push(row.KEY);
                            }
                        }

                        // Keyword Hits
                        for (const kw of keywordArray) {
                            if (lower.includes(kw)) {
                                const tag = `goldrush:${kw}`;
                                if (!registry[tag]) registry[tag] = [];
                                if (!registry[tag].includes(row.KEY)) registry[tag].push(row.KEY);
                            }
                        }
                    }
                    currentStr = "";
                }
            }
        } catch (e) {
            // Skip malformed entries
        }

        if (row.KEY % 5000 === 0) console.log(`   - Index ${row.KEY} analyzed...`);
    }

    const outputPath = path.join(OUTPUT_DIR, "goldrush_register.json");
    fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2));
    
    console.log("\n✅ GOLDRUSH SYMBOLIC SYNTHESIS COMPLETE");
    console.log(`💾 Registry saved to: ${outputPath}`);
    console.log(`🔍 Total Nodes Discovered: ${Object.keys(registry).length}`);
    
    // Top hits
    const entries = Object.entries(registry).sort((a,b) => b[1].length - a[1].length).slice(0, 10);
    entries.forEach(([tag, ids]) => {
        console.log(`   ${tag.padEnd(30)}: Found in ${ids.length} scripts`);
    });
}

runGoldrush().catch(console.error);
