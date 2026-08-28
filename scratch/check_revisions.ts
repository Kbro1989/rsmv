import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    
    for (const id of [1404, 1946, 703]) {
        const index = await loader.getIndexEntryById(cacheMajors.interfaces, id);
        console.log(`Interface ${id}: revision ${index.version}`);
    }
}

main().catch(console.error);
