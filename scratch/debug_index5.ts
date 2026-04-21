import { GameCacheLoader } from "./src/cache/sqlite";
import { cacheMajors } from "./src/constants";

async function debugIndex5() {
    const loader = new GameCacheLoader("C:\ProgramData\Jagex\RuneScape");
    const index = await loader.getCacheIndex(cacheMajors.maps);
    
    console.log(`Index 5 total archives: ${index.length}`);
    for (let i = 0; i < Math.min(index.length, 20); i++) {
        const entry = index[i];
        if (!entry) continue;
        console.log(`Archive ${entry.minor}: Subfiles: ${entry.subindices.join(", ")} | NameHash: ${entry.name}`);
    }
}

debugIndex5().catch(console.error);

