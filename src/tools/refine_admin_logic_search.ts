import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { prepareClientScript } from "../clientscript/index";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function refineAdminLogic() {
    console.log(`🔍 Refining Admin Logic Search — Filtering for Actual Command Handling...`);
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    await prepareClientScript(source);

    const logicScripts: Record<number, string[]> = {};

    // Scan the first 20k scripts for logic-heavy strings
    for (let id = 0; id < 20000; id++) {
        try {
            const row = await table.readFile(id);
            if (!row || !row.DATA) continue;

            const file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            const script = parse.clientscript.read(file, source);

            let hasCommandString = false;
            let commands: string[] = [];

            script.opcodedata.forEach((op: any, index: number) => {
                if (op.imm_obj && typeof op.imm_obj === "string") {
                    const text = op.imm_obj.trim().toLowerCase();
                    if (text.startsWith("::")) {
                        // Check if the next few opcodes contain branching logic
                        // Opcode 36/37 for IF_STREQUALS/IF_STRNEQUALS
                        const nextOps = script.opcodedata.slice(index + 1, index + 5);
                        const isLogic = nextOps.some((nextOp: any) => 
                            nextOp.opcode >= 36 && nextOp.opcode <= 37
                        );

                        if (isLogic) {
                            hasCommandString = true;
                            commands.push(text.slice(2));
                        }
                    }
                }
            });

            if (hasCommandString) {
                logicScripts[id] = commands;
                console.log(`🎯 Logic Found in Script ${id}: [::${commands.join(", ::")}]`);
            }
        } catch (err) {
            // Skip parsing errors
        }

        if (id % 1000 === 0) console.log(`   Processed ${id} scripts...`);
    }

    console.log("\n✅ LOGIC SCAN COMPLETE.");
    console.log("------------------------------------------");
    Object.entries(logicScripts).forEach(([id, cmds]) => {
        console.log(`Script ${id} processes commands: ::${cmds.join(", ::")}`);
    });

    source.close();
}

refineAdminLogic().catch(console.error);
