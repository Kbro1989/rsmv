import { GameCacheLoader } from '../cache/sqlite';
import { OpcodeReader } from '../opcode_reader';
import { parse } from '../opdecoder';
import * as fs from 'fs';

async function findAdminCommands() {
    console.log("[Goldrush] Initializing Admin Command Scanner...");
    const loader = new GameCacheLoader('C:/ProgramData/Jagex/RuneScape');
    
    const externalFiles = [
        "D:\\ProgramData\\Jagex\\launcher\\instance.lock",
        "D:\\ProgramData\\Jagex\\launcher\\preferences.cfg",
        "D:\\ProgramData\\Jagex\\launcher\\rs2client.exe"
    ];

    const results: any[] = [];

    // 1. Scan External Files
    console.log("[Goldrush] Scanning external launcher files...");
    for (const filePath of externalFiles) {
        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath);
                if (data.includes(Buffer.from('::', 'utf-8'))) {
                    console.log(`[FOUND] External File ${filePath} contains '::' signature.`);
                    results.push({
                        type: "external",
                        id: filePath,
                        commands: ["<binary signature>"]
                    });
                }
            } catch (e) {
                console.log(`[Goldrush] Could not read ${filePath}: ${e}`);
            }
        }
    }

    // 2. Scan ClientScripts
    const index = await loader.getCacheIndex(12);
    const scriptIds = Object.keys(index).map(Number).sort((a,b) => a-b);
    
    console.log(`[Goldrush] Scanning ${scriptIds.length} ClientScripts for '::' signatures...`);

    for (const scriptId of scriptIds) {
        try {
            const archive = index[scriptId];
            const files = await loader.getFileArchive(archive);
            const scriptData = files[0].buffer;
            
            if (scriptData.includes(Buffer.from('::', 'utf-8'))) {
                const script = parse.clientscript.read(scriptData, loader);
                const commandStrings = script.instructions
                    .filter((inst: any) => inst.opcode === 3 && typeof inst.imm === 'string' && inst.imm.includes('::'))
                    .map((inst: any) => inst.imm);
                
                if (commandStrings.length > 0) {
                    console.log(`[FOUND] Script ${scriptId}: ${commandStrings.join(", ")}`);
                    results.push({
                        type: "clientscript",
                        id: scriptId,
                        commands: commandStrings
                    });
                }
            }
        } catch (e) { }
    }

    const outPath = 'D:/sovereign/memory/pedagogy/admin_commands_discovered.json';
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`[Goldrush] Scan complete. ${results.length} total hits cataloged to ${outPath}`);
}

findAdminCommands();
