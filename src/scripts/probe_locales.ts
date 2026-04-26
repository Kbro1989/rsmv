import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function probeLocales(target: string) {
    console.log(`🔍 Searching for "${target}" in Major 34 (Locales)...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    try {
        const index = await source.getCacheIndex(34);
        console.log(`Major 34 has ${index.length} archives.`);
        
        for (let i = 0; i < Math.min(index.length, 20); i++) {
            if (!index[i]) continue;
            try {
                const arch = await source.getFileArchive(index[i]);
                for (const file of arch) {
                    const str = file.buffer.toString('utf8');
                    if (str.toLowerCase().includes(target.toLowerCase())) {
                        console.log(`[FOUND] Arch ${i}, File ${file.fileid}: "${str}"`);
                    }
                }
            } catch (e) {
                // Skip erroring archives
            }
        }
    } catch (error) {
        console.error("❌ Search failed:", error);
    } finally {
        source.close();
    }
}

const target = process.argv[2] || "Observatory professor";
probeLocales(target).catch(console.error);


