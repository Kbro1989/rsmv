import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const SCRIPT_ID = 4166;

async function dumpScript() {
    console.log(`🔍 Dumping ClientScript ${SCRIPT_ID}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    // ClientScripts (Major 12) are 1:1 ArchiveID
    const row = await source.openTable(cacheMajors.clientscript).readFile(SCRIPT_ID);
    if (row && row.DATA) {
        const file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
        const script = parse.clientscript.read(file, source);
        console.log("Script Decoded:");
        // console.log(JSON.stringify(script, null, 2));
        
        console.log("\nInstructions (Raw):");
        script.opcodedata.forEach((op: any, i: number) => {
            console.log(`[${i}] Op: ${op.opcode} Imm: ${op.imm} ${op.imm_obj ? `Obj: ${JSON.stringify(op.imm_obj)}` : ""}`);
        });
    } else {
        console.log(`Script ${SCRIPT_ID} not found.`);
    }
    
    source.close();
}

dumpScript().catch(console.error);

