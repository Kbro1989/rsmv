const { GameCacheLoader } = require("../cache/sqlite");
const { cacheMajors } = require("../constants");
const { parse } = require("../opdecoder");

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function scanAdminCommands() {
    console.log(`🔍 Scanning ClientScripts (Archive 12) for Admin Commands...`);
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    const totalFiles = 20000;
    const commandsFound = {};

    for (let id = 0; id < totalFiles; id++) {
        try {
            const row = await table.readFile(id);
            if (!row || !row.DATA) continue;

            const file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            const script = parse.clientscript.read(file, source);

            script.opcodedata.forEach((op) => {
                if (op.imm_obj && typeof op.imm_obj === "string") {
                    const text = op.imm_obj.trim();
                    if (text.startsWith("::")) {
                        const cmd = text.slice(2).toLowerCase();
                        if (!commandsFound[cmd]) commandsFound[cmd] = [];
                        if (!commandsFound[cmd].includes(id)) {
                            commandsFound[cmd].push(id);
                        }
                    } else if (text.includes("::")) {
                        const match = text.match(/::([a-z0-0_]+)/i);
                        if (match) {
                            const cmd = match[1].toLowerCase();
                            if (!commandsFound[cmd]) commandsFound[cmd] = [];
                            if (!commandsFound[cmd].includes(id)) {
                                commandsFound[cmd].push(id);
                            }
                        }
                    }
                }
            });
        } catch (err) {}

        if (id % 1000 === 0) {
            process.stdout.write(`.`);
        }
    }

    console.log("\n✅ SCAN COMPLETE.");
    
    const sortedCmds = Object.keys(commandsFound).sort();
    sortedCmds.forEach(cmd => {
        console.log(`[::${cmd}] Scripts: ${commandsFound[cmd].join(", ")}`);
    });

    source.close();
}

scanAdminCommands().catch(console.error);
