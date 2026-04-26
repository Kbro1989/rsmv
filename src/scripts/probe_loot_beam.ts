import { GameCacheLoader } from "../cache/sqlite.js";
import { parse } from "../opdecoder.js";
import { cacheMajors } from "../constants.js";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function run() {
    const source = new GameCacheLoader(CACHE_DIR);
    const index = await source.getCacheIndex(cacheMajors.items);
    console.log("Searching items for 'Loot beam'...");
    for (const file of index) {
        try {
            const arch = await source.getFileArchive(file);
            for (const item of arch) {
                try {
                    const parsed = parse.item.read(item.buffer, source);
                    if (parsed.name && parsed.name.toLowerCase().includes("loot beam")) {
                        console.log(`Item ID: ${item.fileid}, Name: ${parsed.name}`);
                        console.log(parsed);
                    }
                } catch(e) {}
            }
        } catch(e) {}
    }
}
run();
