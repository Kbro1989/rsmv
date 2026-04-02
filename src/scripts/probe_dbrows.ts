import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function probe() {
    console.log("🔍 Scanning All DBRows for Table Distribution (Silent)...");
    const source = new GameCacheLoader(CACHE_DIR);
    const dbrowsIndex = await source.getCacheIndex(cacheMajors.config);
    const page = dbrowsIndex.find(p => p && p.minor === cacheConfigPages.dbrows);
    
    if (page) {
        const arch = await source.getFileArchive(page);
        const tableCounts: Map<number, number> = new Map();
        const firstFileId: Map<number, number> = new Map();
        
        console.log(`Analyzing ${arch.length} files...`);
        for (const file of arch) {
            try {
                // Manually suppress console.log/warn during this parse
                const oldLog = console.log;
                const oldWarn = console.warn;
                console.log = () => {};
                console.warn = () => {};
                
                const row = parse.dbrows.read(file.buffer, source);
                
                console.log = oldLog;
                console.warn = oldWarn;

                const tid = (row as any).table;
                if (typeof tid === "number") {
                    tableCounts.set(tid, (tableCounts.get(tid) || 0) + 1);
                    if (!firstFileId.has(tid)) firstFileId.set(tid, file.fileid);
                }
            } catch (e) {
                // Restore if it crashes
                // console.log = oldLog;
                // console.warn = oldWarn;
            }
        }
        
        console.log("\nTable Distribution in DBRows:");
        const sorted = Array.from(tableCounts.entries()).sort((a, b) => b[1] - a[1]);
        sorted.forEach(([tid, count]) => {
            console.log(`Table ${tid}: ${count} rows (First Row FileID: ${firstFileId.get(tid)})`);
        });
    }
    source.close();
}

probe().catch(console.error);
