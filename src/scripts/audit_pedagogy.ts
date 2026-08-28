import * as fs from "fs";
import * as path from "path";

const PEDAGOGY_DIRS = [
    "D:\\sovereign\\memory\\pedagogy",
    "D:\\sovereign\\atlas"
];
const SEARCH_TERMS = ["Observatory", "Professor", "Sextant", "488", "6121", "32322"];

async function auditPedagogy() {
    console.log("🔍 Sovereign Pedagogical Audit - Searching for Logic Bridges...");
    
    for (const dir of PEDAGOGY_DIRS) {
        if (!fs.existsSync(dir)) continue;
        console.log(`📂 Scanning ${dir}...`);
        const files = fs.readdirSync(dir, { recursive: true }) as string[];
        
        for (const file of files) {
            if (!file.endsWith(".json")) continue;
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) continue;
        const stats = fs.statSync(filePath);
        if (stats.size > 10 * 1024 * 1024) continue; // Skip huge files for now
        
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            for (const term of SEARCH_TERMS) {
                if (content.includes(term)) {
                    console.log(`[FOUND] "${term}" in ${file}`);
                    // Optionally log a snippet
                    const index = content.indexOf(term);
                    console.log(`   Snippet: ...${content.substring(index - 50, index + 50)}...`);
                }
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e);
        }
        }
    }
}

auditPedagogy().catch(console.error);
