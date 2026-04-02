import { GameCacheLoader } from "../cache/sqlite";
import { parse } from "../opdecoder";
import { cacheMajors, cacheConfigPages } from "../constants";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function researchNPCs() {
    console.log("Searching for NPC Spawn DBTable...");
    const source = new GameCacheLoader(CACHE_DIR);
    
    try {
        const dbrowsIndex = await source.getCacheIndex(cacheMajors.config);
        const page = dbrowsIndex.find(p => p.minor === cacheConfigPages.dbrows);
        if (!page) {
            console.error("DBRows page not found.");
            return;
        }

        const arch = await source.getFileArchive(page);
        console.log(`Found ${arch.length} DBRows files.`);
        
        const tableCounts: Record<number, number> = {};
        for (let i = 0; i < Math.min(arch.length, 1000); i++) {
            const file = arch[i];
            try {
                const row = parse.dbrows.read(file.buffer, source);
                const tableId = row.table ?? -1;
                tableCounts[tableId] = (tableCounts[tableId] || 0) + 1;
            } catch (e) {}
        }
        
        console.log("Table distribution (first 1000 rows):", tableCounts);
    } catch (e) {
        console.error("Research failed:", e);
    }
}

researchNPCs();
