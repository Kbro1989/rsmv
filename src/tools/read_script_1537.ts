import { GameCacheLoader } from "../cache/sqlite";
import { renderClientScript } from "../clientscript/index";
import { cacheMajors } from "../constants";
import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const SCRIPT_ID = 1537;
const OUTPUT_DIR = "D:\\sovereign\\atlas\\forensics";

async function main() {
    const source = new GameCacheLoader(CACHE_DIR);
    
    console.log(`🔍 Preparing to decompile ClientScript ${SCRIPT_ID}...`);

    try {
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        const buf = await source.getFileById(cacheMajors.clientscript, SCRIPT_ID);
        console.log(`✅ Script ${SCRIPT_ID} binary retrieved (${buf.length} bytes).`);

        console.log("🛠️ Starting Deobfuscation and TS Rendering (This may take a minute)...");
        const tsSource = await renderClientScript(source, buf, SCRIPT_ID);
        
        const outputPath = path.join(OUTPUT_DIR, `script_${SCRIPT_ID}_deob.ts`);
        fs.writeFileSync(outputPath, tsSource);

        console.log(`\n✅ DECOMPILATION COMPLETE.`);
        console.log(`📄 Saved to: ${outputPath}`);
        console.log(`------------------------------------------`);
        
        // Output a snippet for immediate feedback
        const lines = tsSource.split("\n");
        console.log("LOGIC SNIPPET (First 20 lines):");
        console.log(lines.slice(0, 20).join("\n"));

    } catch (err) {
        console.error(`❌ FAILED to decompile script ${SCRIPT_ID}:`, err instanceof Error ? err.stack : err);
    }
}

main().catch(console.error);

