import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";

async function probe() {
    console.log("🚀 Probing DBTable Registry...");
    const source = new GameCacheLoader(CACHE_DIR);

    try {
        const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
        const arch = await source.getFileArchive(archInfo);
        
        const tableCounts: Record<number, number> = {};

        for (const file of arch) {
            if (file.buffer.length < 2) continue;
            const tableId = file.buffer[1];
            tableCounts[tableId] = (tableCounts[tableId] || 0) + 1;
        }

        console.log("Found Tables:");
        Object.entries(tableCounts).sort((a,b) => b[1] - a[1]).forEach(([id, count]) => {
            console.log(`Table ${id}: ${count} rows`);
        });

    } catch (error) {
        console.error("❌ Probe failed:", error);
    } finally {
        source.close();
    }
}

probe().catch(console.error);

