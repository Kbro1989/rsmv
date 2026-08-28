import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    const major = 3;
    const minor = 1946;
    const arch = await loader.getArchiveById(major, minor);
    
    for (let i = 0; i < Math.min(3, arch.length); i++) {
        const sub = arch[i];
        console.log(`Subfile ${sub.fileid} (size ${sub.buffer.length}):`);
        console.log(sub.buffer.subarray(0, 64).toString('hex'));
    }
}

main().catch(console.error);
