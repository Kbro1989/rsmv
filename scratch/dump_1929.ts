import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    const major = 3;
    const minor = 1929;
    const arch = await loader.getArchiveById(major, minor);
    
    const sub = arch[0];
    console.log(`1929 Subfile 0 (size ${sub.buffer.length}):`);
    console.log(sub.buffer.subarray(0, 64).toString('hex'));
}

main().catch(console.error);
