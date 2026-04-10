import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function probe() {
    const source = new GameCacheLoader(CACHE_DIR);
    (source as any).buildnr = 928; // FORCE MODERN BUILD
    
    const targetId = 42103;
    const archId = targetId >> 8;
    const subId = targetId & 0xFF;
    
    try {
        const index = await source.getCacheIndex(cacheMajors.items);
        const arch = await source.getFileArchive(index[archId]);
        const file = arch.find(f => f.fileid === subId);
        
        if (file) {
            const item = parse.item.read(file.buffer, source);
            console.log(JSON.stringify(item, null, 2));
        }
    } finally {
        source.close();
    }
}

probe().catch(console.error);
