import { GameCacheLoader } from "./src/cache/sqlite";
import { cacheMajors } from "./src/constants";

async function fastStringSearch() {
    const loader = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    const index = await loader.getCacheIndex(cacheMajors.clientscript);
    const scriptIds = Object.keys(index).map(Number).sort((a,b) => a-b);
    
    console.log(`[FastScan] Scanning ${scriptIds.length} ClientScripts for '::' or ';;' raw bytes...`);
    
    let hits = 0;
    for (const id of scriptIds) {
        try {
            const buf = await loader.getFile(cacheMajors.clientscript, id, index[id].crc);
            // Search for "::" (0x3A 0x3A) or ";;" (0x3B 0x3B)
            if (buf.includes("::") || buf.includes(";;")) {
                console.log(`[HIT] Script ${id} contains admin prefix pattern.`);
                hits++;
            }
        } catch (e) {}
    }
    console.log(`[FastScan] Completed. Total hits: ${hits}`);
    loader.close();
}
fastStringSearch();
