import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function fastScan() {
    console.log("🚀 Sovereign Fast Admin Logic Scan — Pre-Filtering Substrates");
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    const possibleLogicScripts: number[] = [];
    const SEARCH_STR = "::";
    
    console.log("📡 Phase 1: Pre-filtering 20k scripts for '::' Buffer matches...");
    for (let id = 0; id < 20000; id++) {
        try {
            const row = await table.readFile(id);
            if (!row || !row.DATA) continue;
            
            const buf = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            // Fast check for the string "::"
            if (buf.includes(Buffer.from(SEARCH_STR, 'utf8'))) {
                possibleLogicScripts.push(id);
            }
        } catch (e) {}
        if (id % 5000 === 0) console.log(`   Scanned ${id}...`);
    }

    console.log(`🎯 Identified ${possibleLogicScripts.length} candidate scripts. Phase 2: Logic Scrutiny.`);
    
    const actualLogic: Record<number, string[]> = {};

    for (const id of possibleLogicScripts) {
        try {
            const row = await table.readFile(id);
            const file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            // We parse only candidates
            const script = parse.clientscript.read(file, source);
            
            let cmds: string[] = [];
            script.opcodedata.forEach((op: any, i: number) => {
                if (op.imm_obj && typeof op.imm_obj === "string" && op.imm_obj.startsWith("::")) {
                    // Logic check: Is it followed by a branch?
                    const next = script.opcodedata.slice(i + 1, i + 4);
                    const isLogic = next.some((n: any) => n.opcode >= 36 && n.opcode <= 37); // Branching opcodes
                    if (isLogic) cmds.push(op.imm_obj.slice(2));
                }
            });

            if (cmds.length > 0) {
                actualLogic[id] = cmds;
                console.log(`✅ [LOGIC] Script ${id}: ::${cmds.join(", ::")}`);
            }
        } catch (e) {}
    }

    console.log("\n🧪 Sovereign Admin Truth Summary:");
    console.log(JSON.stringify(actualLogic, null, 2));
    source.close();
}

fastScan().catch(console.error);
