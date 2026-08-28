import { GameCacheLoader } from "./src/cache/sqlite";
import { cacheMajors } from "./src/constants";

async function extractStrings() {
    const loader = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    const ids = [2335, 4718, 7115, 7478, 10393, 15156, 15162, 16415, 16417, 16504, 19699];
    
    for (const id of ids) {
        const buf = await loader.getFile(cacheMajors.clientscript, id, 0);
        // Find all printable strings of length >= 3
        const strings: string[] = [];
        let current = "";
        for (let i = 0; i < buf.length; i++) {
            const char = buf[i];
            if (char >= 32 && char <= 126) {
                current += String.fromCharCode(char);
            } else {
                if (current.length >= 3) {
                    strings.push(current);
                }
                current = "";
            }
        }
        if (current.length >= 3) strings.push(current);
        
        const adminStrings = strings.filter(s => s.includes("::") || s.includes(";;"));
        if (adminStrings.length > 0) {
            console.log(`[Script ${id}] Admin Strings:`, adminStrings);
        }
    }
    loader.close();
}
extractStrings();
