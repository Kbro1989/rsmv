import { GameCacheLoader } from "./src/cache/sqlite";
import { cacheMajors, cacheConfigPages } from "./src/constants";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function dumpDbRowHex() {
    const source = new GameCacheLoader(CACHE_DIR);
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const arch = await source.getFileArchive(archInfo);

    // Let's pick one that we saw had columndata in the JSON dump
    const file = arch.find(f => f.fileid === 89);
    if (file) {
        console.log(`Hex for dbrow 89:`);
        console.log(file.buffer.toString('hex'));
    }

    source.close();
}

dumpDbRowHex().catch(console.error);
