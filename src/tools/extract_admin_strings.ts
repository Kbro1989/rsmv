import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { prepareClientScript } from "../clientscript/index";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";
const TARGET_IDS = [16441, 1024, 15125, 16525, 17147, 18819];

async function run() {
    console.log("🚀 Sovereign Admin Logic Forensic — String Pool Decryption");
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    await prepareClientScript(source);

    for (const id of TARGET_IDS) {
        try {
            const row = await table.readFile(id);
            if (!row || !row.DATA) continue;

            const file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            const script = parse.clientscript.read(file, source);
            
            console.log(`\n📄 Analyzing Script ${id} (${file.length} bytes):`);
            const strings = script.opcodedata
                .filter((op: any) => op.imm_obj && typeof op.imm_obj === "string")
                .map((op: any) => op.imm_obj);
            
            const commands = strings.filter((s: string) => s.startsWith("::") || s.startsWith(";;"));
            if (commands.length > 0) {
                console.log(`   🎯 HANDLED COMMANDS: ${commands.join(", ")}`);
            } else {
                console.log(`   🤷 Mentions found but no explicit Command Logic (:: prefix).`);
                console.log(`   📝 Sample Strings: ${strings.slice(0, 5).join(" | ")}...`);
            }
        } catch (e) {
            console.log(`❌ Failed to parse script ${id}.`);
        }
    }

    source.close();
}

run().catch(console.error);
