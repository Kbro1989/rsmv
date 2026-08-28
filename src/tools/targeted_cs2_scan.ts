import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DB = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function main() {
    console.log("🔍 Scanning ClientScripts (Major 12) from Live Cache for User Terms...");
    const source = new GameCacheLoader(CACHE_DB);
    const index = await source.getCacheIndex(cacheMajors.clientscript);
    
    const targets = ["mouse", "sextant", "platypus", "playtpus", "cart", "keldagrim"];
    const results: Record<string, number[]> = {};

    let processed = 0;
    for (let entry of index) {
        if (!entry) continue;
        const id = entry.minor;

        try {
            const buf = await source.getFile(entry.major, entry.minor, entry.crc);
            let currentString = "";
            for (let i = 0; i < buf.length; i++) {
                const byte = buf[i];
                if (byte >= 32 && byte <= 126) {
                    currentString += String.fromCharCode(byte);
                } else {
                    if (currentString.length >= 4) {
                        const lower = currentString.toLowerCase();
                        for (const t of targets) {
                            if (lower.includes(t)) {
                                if (!results[t]) results[t] = [];
                                if (!results[t].includes(id)) results[t].push(id);
                            }
                        }
                    }
                    currentString = "";
                }
            }
        } catch (e) { }
        
        processed++;
        if (processed % 5000 === 0) console.log(`Processed ${processed} scripts...`);
    }

    console.log("\n✅ Target Scan Complete:\n", JSON.stringify(results, null, 2));
}
main().catch(console.error);


