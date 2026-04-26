import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { prepareClientScript } from "../clientscript/index";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function scanAdminCommands() {
    console.log(`🔍 Scanning ClientScripts (Archive 12) for Admin Commands...`);
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    // Scan all indices in Major 12
    const totalFiles = 20000; // Upper bound estimate
    let errorCount = 0;
    
    console.log("🛠️ Preparing ClientScript Deobfuscator (This may take a moment)...");
    await prepareClientScript(source);
    console.log("✅ Deobfuscator Ready.");

    const commandsFound: Record<string, number[]> = {};

    for (let id = 0; id < totalFiles; id++) {
        try {
            const row = await table.readFile(id);
            if (!row || !row.DATA) continue;

            const file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            const script = parse.clientscript.read(file, source);

            // Scan instructions for string literals (imm_obj)
            script.opcodedata.forEach((op: any) => {
                if (op.imm_obj && typeof op.imm_obj === "string") {
                    const text = op.imm_obj.trim().toLowerCase();
                    if (text.startsWith("::")) {
                        const cmd = text.slice(2);
                        if (!commandsFound[cmd]) commandsFound[cmd] = [];
                        if (!commandsFound[cmd].includes(id)) {
                            commandsFound[cmd].push(id);
                        }
                    } else if (text.includes("varbit") || text.includes("varp") || text.includes("config") || text.includes("gate")) {
                        // Potential dynamic-state logic strings
                        const label = `semantic:${text}`;
                        if (!commandsFound[label]) commandsFound[label] = [];
                        if (!commandsFound[label].includes(id)) {
                            commandsFound[label].push(id);
                        }
                    }
                }
            });
        } catch (err) {
            // Silently skip but count errors
            errorCount++;
            if (errorCount < 5) console.error(`[Error] Failed to parse script ${id}:`, err instanceof Error ? err.message : err);
        }

        if (id % 1000 === 0) {
            console.log(`   Processed ${id} scripts...`);
        }
    }

    console.log("\n✅ SCAN COMPLETE. Discovered Command Register:");
    console.log("------------------------------------------");
    
    const sortedCmds = Object.keys(commandsFound).sort();
    sortedCmds.forEach(cmd => {
        console.log(`[::${cmd}] Found in Scripts: ${commandsFound[cmd].join(", ")}`);
    });

    source.close();
}

scanAdminCommands().catch(console.error);


