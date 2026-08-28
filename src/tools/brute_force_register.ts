import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import * as fs from "fs";
import * as path from "path";

// Authoritative Jagex Cache Path
const CACHE_PATH = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const JSON_DUMPS = "D:\\sovereign\\cache_pedagogy\\json_dumps";

async function main() {
    const source = new GameCacheLoader(CACHE_PATH);
    const commandsFound: Record<string, number[]> = {};
    
    // Dynamic Keyword Goldrush (Load from Sovereign Dumps)
    console.log("💰 Loading Forensic Goldrush Keywords from Sovereign Dumps...");
    const keywords = new Set(["varbit", "varp", "config", "gate", "obj", "npc", "tele", "pos"]);
    
    const dumpFiles = ["enums.json", "objects.json", "npcs.json", "items.json", "materials.json"];
    for (const file of dumpFiles) {
        const filePath = path.join(JSON_DUMPS, file);
        if (fs.existsSync(filePath)) {
            console.log(`   - Extracting semantics from ${file}...`);
            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
            
            // Extract Names and Semantic Strings
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (item.name && item.name.length > 3 && !item.name.includes("OBJECTS")) {
                        keywords.add(item.name.toLowerCase());
                    }
                }
            } else {
                // Enums format (Map of IDs to Meta)
                for (const key in data) {
                    const entry = data[key];
                    if (entry.map) {
                        for (const mk in entry.map) {
                            const val = entry.map[mk];
                            if (typeof val === "string" && val.length > 4) {
                                keywords.add(val.toLowerCase());
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`🔥 Total High-Value Forensic Keywords: ${keywords.size}`);
    console.log("🦾 Starting Goldrush Forensic Scan of Major 12 (ClientScripts)...");

    const index = await source.getCacheIndex(cacheMajors.clientscript);
    const keywordArray = Array.from(keywords);
    
    for (let entry of index) {
        if (!entry) continue;
        const id = entry.minor;

        try {
            const buf = await source.getFile(entry.major, entry.minor, entry.crc);
            
            // Brute force string extraction
            let currentString = "";
            for (let i = 0; i < buf.length; i++) {
                const byte = buf[i];
                if (byte >= 32 && byte <= 126) {
                    currentString += String.fromCharCode(byte);
                } else {
                    if (currentString.length > 3) {
                        const lower = currentString.toLowerCase();
                        
                        // Command detection (::)
                        if (lower.includes("::")) {
                            const match = lower.match(/::([a-z0-9_]+)/);
                            if (match) {
                                const cmd = `cmd:${match[1]}`;
                                if (!commandsFound[cmd]) commandsFound[cmd] = [];
                                if (!commandsFound[cmd].includes(id)) commandsFound[cmd].push(id);
                            }
                        }

                        // Goldrush Keyword Matching
                        for (const kw of keywordArray) {
                            if (lower.includes(kw)) {
                                const label = `goldrush:${kw}`;
                                if (!commandsFound[label]) commandsFound[label] = [];
                                if (!commandsFound[label].includes(id)) commandsFound[label].push(id);
                            }
                        }
                    }
                    currentString = "";
                }
            }
        } catch (e) {
            // Skip broken scripts
        }

        if (id % 2000 === 0) {
            console.log(`   Processed ${id} scripts... [Found: ${Object.keys(commandsFound).length} nodes]`);
        }
    }

    console.log("\n✅ GOLDRUSH SCAN COMPLETE. Discovered Sovereign Registers:");
    console.log("---------------------------------------------------------");
    
    const sorted = Object.entries(commandsFound)
        .sort((a, b) => b[1].length - a[1].length);

    // Write results to Sovereign Memory
    const outputPath = path.join("D:\\sovereign\\memory\\pedagogy", "goldrush_register.json");
    fs.writeFileSync(outputPath, JSON.stringify(commandsFound, null, 2));
    console.log(`💾 Saved ${sorted.length} semantic mappings to ${outputPath}`);

    // Peak at Top 20
    for (const [cmd, ids] of sorted.slice(0, 20)) {
        console.log(`${cmd.padEnd(30)}: [${ids.length} scripts] -> ${ids.slice(0, 3).join(", ")}...`);
    }
}

main().catch(console.error);


