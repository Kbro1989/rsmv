import { GameCacheLoader } from "./cache/sqlite";
import { cacheMajors } from "./constants";

async function dumpNames() {
    const loader = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    const index = await loader.getCacheIndex(cacheMajors.mapsquares);
    
    console.log("Valid Archive IDs in Major 5:");
    let found = 0;
    for (let i = 0; i < index.length; i++) {
        if (index[i]) {
            console.log(`  ID: ${i} (Minor: ${index[i].minor})`);
            found++;
            if (found > 50) break;
        }
    }
    loader.close();
}

dumpNames().catch(console.error);
