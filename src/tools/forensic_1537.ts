import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import * as fs from "fs";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const SCRIPT_ID = 1537;

async function main() {
    const source = new GameCacheLoader(CACHE_DIR);
    console.log(`💀 GHOST-LIMB FORENSIC ANALYSIS: Script ${SCRIPT_ID}`);

    try {
        const buf = await source.getFileById(cacheMajors.clientscript, SCRIPT_ID);
        console.log(`✅ Script binary retrieved (${buf.length} bytes).`);

        // Forensic Scan for Strings
        const strings: string[] = [];
        let currentString = "";
        for (let i = 0; i < buf.length; i++) {
            const byte = buf[i];
            if (byte >= 32 && byte <= 126) {
                currentString += String.fromCharCode(byte);
            } else {
                if (currentString.length > 3) strings.push(currentString);
                currentString = "";
            }
        }

        console.log("\n📜 STRINGS DISCOVERED:");
        strings.forEach(s => console.log(`   - "${s}"`));

        // Logical Structure Inference
        // Modern CS2: [header: 20 bytes?] [opcodes...]
        // We look for repeated patterns of 3-6 bytes (int/byte opcodes)
        
        console.log("\n🧪 LOGICAL INFERENCE:");
        if (strings.some(s => s.toLowerCase().includes("tele"))) {
            console.log("   [Trigger] Teleportation logic detected.");
        }
        if (strings.some(s => s.toLowerCase().includes("gate"))) {
            console.log("   [Trigger] Gate/Collision logic detected.");
        }
        
        // Final Output for the user
        console.log("\n✅ ANALYSIS COMPLETE.");
    } catch (err) {
        console.error("❌ FAILED:", err);
    }
}

main().catch(console.error);

