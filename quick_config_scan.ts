import { GameCacheLoader } from "./src/cache/sqlite";
import { cacheMajors, cacheConfigPages } from "./src/constants";

async function dumpConfigStrings() {
    const loader = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    console.log("Searching Major 2 (Configs)...");
    
    // Major 2 has many archives. Archive 67 is params.
    const archives = await loader.getArchiveById(cacheMajors.config, cacheConfigPages.params);
    for (const file of archives) {
        const content = file.buffer.toString("latin1");
        if (content.includes("::") || content.includes(";;")) {
            console.log(`[FOUND] Config ${file.fileid} contains admin signature.`);
            // Match strings starting with :: or ;;
            const matches = content.match(/[:;]{2}[a-zA-Z0-9_]+/g);
            if (matches) {
                console.log(`  Matches: ${matches.join(", ")}`);
            }
        }
    }
    loader.close();
}
dumpConfigStrings();
