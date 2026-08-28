import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    const arch = await loader.getArchiveById(3, 1404);
    const sub = arch[3];
    console.log(`1404:3 Subfile (size ${sub.buffer.length}):`);
    console.log(sub.buffer.subarray(0, 64).toString('hex'));
}

main().catch(console.error);
