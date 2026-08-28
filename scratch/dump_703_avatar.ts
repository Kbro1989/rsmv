import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    const major = 3;
    const minor = 703;
    const arch = await loader.getArchiveById(major, minor);
    
    for (const id of [50, 51]) {
        const sub = arch.find(q => q.fileid === id);
        if (sub) {
            console.log(`Subfile ${id} (size ${sub.buffer.length}):`);
            console.log(sub.buffer.subarray(0, 128).toString('hex'));
        } else {
            console.log(`Subfile ${id} not found.`);
        }
    }
}

main().catch(console.error);
