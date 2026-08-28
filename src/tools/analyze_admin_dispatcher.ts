import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const TARGET_ID = 16441;

async function analyze() {
    console.log(`🚀 Sovereign Dispatcher Analysis — Deconstructing Script ${TARGET_ID}`);
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    const row = await table.readFile(TARGET_ID);
    if (row && row.DATA) {
        const buf = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
        console.log(`Bytecode Size: ${buf.length} bytes`);
        console.log(`Hex Fragment: ${buf.slice(0, 100).toString('hex')}...`);
        
        try {
            const script = parse.clientscript.read(buf, source);
            console.log("📜 Decoded Logic (Strings & Branching):");
            script.opcodedata.forEach((op: any, i: number) => {
                if (op.imm_obj && typeof op.imm_obj === "string") {
                    // console.log(`[${i}] String: ${op.imm_obj}`);
                    const next = script.opcodedata.slice(i + 1, i + 5);
                    const branches = next.filter((n: any) => n.opcode >= 36 && n.opcode <= 37);
                    if (branches.length > 0) {
                        console.log(`🎯 LOGIC DETECTED at index ${i}: "${op.imm_obj}" followed by branches.`);
                    }
                }
            });
        } catch (e) {
            console.log("❌ Decompilation failed, falling back to raw string extraction.");
            // Manual string extraction from buffer
            let str = "";
            for (let i = 0; i < buf.length; i++) {
                if (buf[i] > 31 && buf[i] < 127) str += String.fromCharCode(buf[i]);
                else {
                    if (str.length > 2) console.log(`🔍 String Found: ${str}`);
                    str = "";
                }
            }
        }
    }
    source.close();
}

analyze().catch(console.error);


