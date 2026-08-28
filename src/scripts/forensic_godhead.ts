import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function findGodheadInArchive() {
    console.log("🔍 Forensic String Search in DBRows Archive...");
    const source = new GameCacheLoader(CACHE_DIR);
    
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const arch = await source.getFileArchive(archInfo);

    for (const file of arch) {
        const str = file.buffer.toString('utf8');
        if (str.toLowerCase().includes("godhead")) {
            console.log(`[FOUND] Row ${file.fileid} contains 'godhead'!`);
            // Hex dump the area
            const index = str.toLowerCase().indexOf("godhead");
            const slice = file.buffer.slice(Math.max(0, index - 10), Math.min(file.buffer.length, index + 30));
            console.log(`Hex: ${slice.toString('hex')}`);
            console.log(`Text: ${slice.toString('utf8')}`);
        }
    }
    source.close();
}

findGodheadInArchive().catch(console.error);
