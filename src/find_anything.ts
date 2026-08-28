import { GameCacheLoader } from "./cache/sqlite";
import { cacheMajors } from "./constants";

async function findRegionInAnyMajor(name: string) {
    const loader = new GameCacheLoader("C:\\\\ProgramData\\\\Jagex\\\\RuneScape");
    const rootIndex = await loader.getCacheIndex(cacheMajors.index);
    
    console.log(`Searching for name "${name}" in all majors...`);
    for (const majorInfo of rootIndex) {
        if (!majorInfo) continue;
        const major = majorInfo.minor;
        try {
            const entry = await loader.findFileByName(major, name);
            if (entry) {
                console.log(`🌟 FOUND IT! Name "${name}" exists in Major ${major}, Minor ${entry.minor}`);
                return;
            }
        } catch (e) {}
    }
    console.log("❌ Could not find that name in any major.");
    loader.close();
}

findRegionInAnyMajor("m58_52").catch(console.error);


