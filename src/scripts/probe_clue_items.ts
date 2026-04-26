import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function extractClueItems() {
    console.log("🔍 Scanning for Clue Hunting Items...");
    const source = new GameCacheLoader(CACHE_DIR);
    
    try {
        const itemIndex = await source.getCacheIndex(cacheMajors.items);
        const results = [];
        const globetrotterPieces = [];
        const clueScrolls = [];
        const clueTools = [];
        
        for (const archInfo of itemIndex) {
            if (!archInfo) continue;
            const arch = await source.getFileArchive(archInfo);
            for (const file of arch) {
                try {
                    const item = parse.item.read(file.buffer, source);
                    const id = (archInfo.minor << 8) | file.fileid;
                    if (item && item.name) {
                        const name = item.name.toLowerCase();
                        const result = {
                            id,
                            name: item.name,
                            extra: item.extra || []
                        };
                        
                        if (name.includes("globetrotter")) {
                            globetrotterPieces.push(result);
                        } else if (name.includes("clue scroll")) {
                            clueScrolls.push(result);
                        } else if (name === "sextant" || name === "watch" || name === "chart" || name === "spade") {
                            clueTools.push(result);
                        }
                    }
                } catch (e) {
                    // Skip unparseable legacy items
                }
            }
        }
        
        console.log(`\n=== 🗺️ GLOBETROTTER OUTFIT (${globetrotterPieces.length}) ===`);
        for (const item of globetrotterPieces.sort((a,b) => a.id - b.id)) {
            console.log(`\n[ID: ${item.id}] ${item.name}`);
            if (item.extra && Object.keys(item.extra).length > 0) {
                console.log(JSON.stringify(item.extra, null, 2));
            } else {
                console.log("  No Extra Parameters");
            }
        }

        console.log(`\n=== 🛠️ CLUE TOOLS (${clueTools.length}) ===`);
        for (const item of clueTools.sort((a,b) => a.id - b.id)) {
            console.log(`\n[ID: ${item.id}] ${item.name}`);
            if (item.extra && Object.keys(item.extra).length > 0) {
                console.log(JSON.stringify(item.extra, null, 2));
            }
        }

        // Just sample a few clue scrolls, there are hundreds
        console.log(`\n=== 📜 CLUE SCROLLS (Found ${clueScrolls.length}, showing first 3) ===`);
        for (const item of clueScrolls.slice(0, 3)) {
            console.log(`\n[ID: ${item.id}] ${item.name}`);
            if (item.extra && Object.keys(item.extra).length > 0) {
                console.log(JSON.stringify(item.extra, null, 2));
            }
        }
        
    } catch (error) {
        console.error("❌ Probe failed:", error);
    } finally {
        source.close();
    }
}

extractClueItems().catch(console.error);


