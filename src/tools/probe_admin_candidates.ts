import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function run() {
    console.log("🚀 Sovereign Admin Logic Probe — Identifying Behavioral Dispatchers");
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    // We'll iterate through all scripts and look for ": " (common in command strings)
    // or specific developer sequences.
    const targets = ["::", ";;", "tele ", "give "];
    const logicFound: Record<number, string[]> = {};

    for (let id = 0; id < 20000; id++) {
        try {
            const row = await table.readFile(id);
            if (!row || !row.DATA) continue;
            
            const buf = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            const matches = targets.filter(t => buf.includes(Buffer.from(t, 'utf8')));
            
            if (matches.length > 0) {
                // Now parse and scrutinize for logic
                const script = parse.clientscript.read(buf, source);
                script.opcodedata.forEach((op: any, index: number) => {
                    if (op.imm_obj && typeof op.imm_obj === "string") {
                        const text = op.imm_obj.trim().toLowerCase();
                        if (targets.some(t => text.startsWith(t))) {
                            // HEURISTIC: Is it followed by a branch?
                            const nextOps = script.opcodedata.slice(index + 1, index + 4);
                            const isLogic = nextOps.some((n: any) => n.opcode >= 36 && n.opcode <= 37);
                            if (isLogic) {
                                if (!logicFound[id]) logicFound[id] = [];
                                logicFound[id].push(text);
                            }
                        }
                    }
                });
            }
        } catch (e) {}
        if (id % 5000 === 0) console.log(`   Processed ${id} scripts...`);
    }

    console.log("\n🧪 Sovereign Admin Logic Report:");
    console.log(JSON.stringify(logicFound, null, 2));
    source.close();
}

run().catch(console.error);
