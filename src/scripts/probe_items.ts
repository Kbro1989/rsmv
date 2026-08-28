import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function findItemByName(targetName: string) {
    console.log(`🔍 Searching for raw string: "${targetName}" in Major ${cacheMajors.items}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    // In RS3, Major 19 (Items) is often a collection of many archives.
    // Each archive contains up to 256 files (Partitioned).
    // Archive ID = ItemID >> 8, File ID = ItemID & 0xFF.
    
    const targetBuf = Buffer.from(targetName, "utf8");
    const index = await source.getCacheIndex(cacheMajors.items);

    console.log(`Scanning index with ${index.length} entries...`);
    for (let archId = 0; archId < index.length; archId++) {
        const archInfo = index[archId];
        if (!archInfo) continue;

        try {
            const arch = await source.getFileArchive(archInfo);
            for (const file of arch) {
                if (file.buffer.includes(targetBuf)) {
                    const itemId = (archId << 8) | file.fileid;
                    console.log(`🎯 Found "${targetName}" in Item ID: ${itemId}`);
                    console.log(`Hex Context: ${file.buffer.subarray(0, 128).toString("hex")}`);
                }
            }
        } catch (e) {}
        
        if (archId % 100 === 0) console.log(`Scanned archive ${archId}...`);
    }
    
    source.close();
}

async function start() {
    await findItemByName("Sextant");
    await findItemByName("sextant");
}

start().catch(console.error);


