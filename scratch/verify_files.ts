import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const dir = "C:\\ProgramData\\Jagex\\RuneScape-BETA";
    if (!fs.existsSync(dir)) {
        console.log("Dir not found: " + dir);
        return;
    }
    const files = fs.readdirSync(dir);
    console.log("Files in dir:", files.join(', '));
    
    const target = path.join(dir, "js5-index.jcache");
    console.log("Target exists:", fs.existsSync(target));
}

main().catch(console.error);
