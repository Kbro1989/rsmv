import { GameCacheLoader } from '../src/cache/sqlite.ts';
import { parse } from '../src/opdecoder.ts';
import * as fs from 'fs';

async function main() {
    const cachePath = "C:\\ProgramData\\Jagex\\RuneScape-BETA";
    const loader = new GameCacheLoader(cachePath);
    loader.buildnr = 1149;
    
    try {
        const buf = await loader.getFile(3, 1420);
        const res = parse.interfaces.read(buf, loader);
        fs.writeFileSync("scratch/interface_1420.json", JSON.stringify(res, null, 2));
        console.log("Decompiled 1420 to scratch/interface_1420.json");
    } catch (e) {
        console.error("Failed to decompile 1420:", e);
    }
}

main().catch(console.error);
