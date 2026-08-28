import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    const major = 3;
    const minor = 1946;
    const arch = await loader.getArchiveById(major, minor);
    
    for (const id of [0, 50, 100]) {
        const sub = arch.find(q => q.fileid === id);
        if (sub) {
            console.log(`Subfile ${id} (size ${sub.buffer.length}):`);
            console.log(sub.buffer.subarray(0, 64).toString('hex'));
        }
    }
}

main().catch(console.error);
