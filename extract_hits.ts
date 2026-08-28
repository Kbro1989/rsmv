import { GameCacheLoader } from "./src/cache/sqlite";
import { cacheMajors } from "./src/constants";

async function extractSpecificStrings() {
    const loader = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    const targetIds = [2335, 4718, 7115, 7478, 10393, 15156, 15162, 16415, 16417, 16504, 19699];
    
    console.log(`Extracting strings from ${targetIds.length} scripts...`);
    
    for (const id of targetIds) {
        try {
            const buf = await loader.getFile(cacheMajors.clientscript, id, 0);
            const content = buf.toString("latin1");
            // Match strings starting with :: or ;; and ending with a null byte or non-printable character
            // We'll use a regex that looks for the prefix and captures until the next null byte (0x00)
            const matches = content.match(/[:;]{2}[^\x00-\x1F\x7F-\x9F]+/g);
            if (matches) {
                console.log(`[Script ${id}] Found: ${matches.join(", ")}`);
            }
        } catch (e) {}
    }
    loader.close();
}
extractSpecificStrings();
