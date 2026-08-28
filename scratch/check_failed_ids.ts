import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";
import { parse } from "../src/opdecoder";

async function main() {
    const loader = new GameCacheLoader();
    const indices = await loader.getCacheIndex(cacheMajors.interfaces);
    
    // indices is an array, not a map
    let maxId = 0;
    let total = 0;
    for (let i = 0; i < indices.length; i++) {
        if (indices[i]) { total++; maxId = i; }
    }
    console.log(`Max interface ID: ${maxId}, Total: ${total}`);
    
    // Check which of the real failed IDs exist and what version they have
    const failedIds = [1811, 1812, 1814, 1816, 1848, 1849, 1856, 1869, 1871, 1878, 1881, 1888, 1889, 1897, 1917, 1926, 1929, 1932, 1937, 1939];
    for (const id of failedIds) {
        if (!indices[id]) { console.log(`${id}: NOT IN INDEX`); continue; }
        try {
            const arch = await loader.getArchiveById(cacheMajors.interfaces, id);
            const sub0 = arch[0];
            const ver = sub0.buffer[0];
            // Try parsing
            const state: any = {
                isWrite: false, buffer: sub0.buffer, stack: [], hiddenstack: [],
                scan: 0, endoffset: sub0.buffer.byteLength,
                args: { ...loader.getDecodeArgs(), clientVersion: 1149 }
            };
            try {
                const comp = parse.interfaces.parser.read(state);
                const leftover = sub0.buffer.byteLength - state.scan;
                console.log(`${id}: v${ver}, ${arch.length} subs, PARSED OK (leftover=${leftover})`);
            } catch (e: any) {
                console.log(`${id}: v${ver}, ${arch.length} subs, PARSE FAIL: ${e.message}`);
            }
        } catch (e: any) {
            console.log(`${id}: ERROR: ${e.message}`);
        }
    }
}

main().catch(console.error);
