import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function probe() {
    console.log("🔍 Probing first 5 rows of Table 39...");
    const source = new GameCacheLoader(CACHE_DIR);
    const dbrowsIndex = await source.getCacheIndex(cacheMajors.config);
    const page = dbrowsIndex.find(p => p && p.minor === cacheConfigPages.dbrows);
    
    if (page) {
        const arch = await source.getFileArchive(page);
        let found = 0;
        for (const file of arch) {
            try {
                const oldLog = console.log;
                const oldWarn = console.warn;
                console.log = () => {};
                console.warn = () => {};
                const row = parse.dbrows.read(file.buffer, source);
                console.log = oldLog;
                console.warn = oldWarn;

                if ((row as any).table === 39) {
                    console.log(`\nRow ${file.fileid} (Table 39):`);
                    console.log(`Hex: ${file.buffer.subarray(0, 128).toString("hex")}`);
                    found++;
                    if (found >= 5) break;
                }
            } catch (e) {}
        }
    }
    source.close();
}

probe().catch(console.error);


