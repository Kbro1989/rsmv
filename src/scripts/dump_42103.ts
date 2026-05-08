import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function dumpHex() {
    const source = new GameCacheLoader(CACHE_DIR);
    const targetId = 42103;
    const archId = targetId >> 8;
    const subId = targetId & 0xFF;
    
    try {
        const index = await source.getCacheIndex(cacheMajors.items);
        const archInfo = index[archId];
        const arch = await source.getFileArchive(archInfo);
        const file = arch.find(f => f.fileid === subId);
        
        if (file) {
            console.log("Raw hex of item 42103:");
            console.log(file.buffer.toString('hex').match(/.{1,32}/g).join('\n'));
        }
    } finally {
        source.close();
    }
}

dumpHex().catch(console.error);


