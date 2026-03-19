// @ts-ignore
globalThis.__non_webpack_require__ = (id: string) => {
    try { return require(id); }
    catch (e) { return import(id); }
};

import { EngineCache } from "./src/3d/modeltothree";
import { GameCacheLoader } from "./src/cache/sqlite";
import * as path from "path";

async function dump() {
    const cachePath = "C:\\ProgramData\\Jagex\\RuneScape";
    const loader = new GameCacheLoader(cachePath);
    console.log("Loading cache indices...");
    
    try {
        const major2 = await loader.getCacheIndex(2);
        console.log(`Major 2 has ${major2.length} minors.`);
        
        for (let i = 0; i < Math.min(20, major2.length); i++) {
            if (!major2[i]) continue;
            const file = await loader.getFile(2, i);
            console.log(`Minor ${i}: size=${file.length}, magic=${file.slice(0, 10).toString('hex')}`);
        }
    } catch (e) {
        console.error("Dump failed:", e);
    }
}

dump();
