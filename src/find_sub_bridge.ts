import * as fs from 'fs';
import * as path from 'path';

const SEARCH_PATH = "D:\\sovereign\\atlas\\spatial\\pathing_theory";

function findLogicalBridges() {
    console.log("[GODHEAD] Scanning for logical bridges to High-X zones...");
    const files = fs.readdirSync(SEARCH_PATH, { recursive: true });
    
    for (const file of files) {
        if (typeof file !== 'string') continue;
        const fullPath = path.join(SEARCH_PATH, file);
        if (fs.statSync(fullPath).isDirectory()) continue;
        if (!file.endsWith(".json")) continue;

        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Look for coordinates near the high-X zone found in the Skeleton batch
            if (content.includes("14053") || content.includes("14000")) {
                console.log(`[FOUND BRIDGE] ${file}`);
                // Print a small snippet
                console.log(content.substring(content.indexOf("14000") - 100, content.indexOf("14000") + 100));
            }
        } catch (e) {
            // Skip binary or locked files
        }
    }
}

findLogicalBridges();
