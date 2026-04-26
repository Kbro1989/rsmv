import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function probe() {
    console.log("🔍 Detailed Probe of Table 163...");
    const source = new GameCacheLoader(CACHE_DIR);
    const dbtablesIndex = await source.getCacheIndex(cacheMajors.config);
    const page = dbtablesIndex.find(p => p && p.minor === cacheConfigPages.dbtables);
    
    if (page) {
        const arch = await source.getFileArchive(page);
        
        const tid = 163;
        const tableFile = arch.find(f => f.fileid === tid);
        if (tableFile) {
            console.log(`\n--- Table ${tid} ---`);
            try {
                const table = parse.dbtables.read(tableFile.buffer, source);
                const data = (table as any).unk01 || (table as any).unk02;
                if (data && data.columndata) {
                    for (const bundle of data.columndata) {
                        const summary = bundle.columns.map((c: any) => `Type:0x${c.type.toString(16)}`).join(", ");
                        console.log(`Architecture: [${summary}]`);
                    }
                }
            } catch (e) {
                console.error(`Table ${tid} failed to parse.`);
            }
        }
    }
    source.close();
}

probe().catch(console.error);


