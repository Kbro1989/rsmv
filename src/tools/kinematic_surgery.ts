import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors } from '../constants';
import { parse } from '../opdecoder';

async function surgery() {
    const cache = new GameCacheLoader("C:\ProgramData\Jagex\RuneScape");
    
    console.log("--- NPC 3597 (Toy Mouse) Surgery ---");
    try {
        const file = await cache.getFileById(cacheMajors.npcs, 3597);
        if (file) {
            const def: any = (parse as any).npc.read(file, cache);
            console.log("Def Name:", def.name);
            console.log("Extra (Params):", JSON.stringify(def.extra, null, 2));
            console.log("Opcodes Found:", Object.keys(def));
        }
    } catch (e) {
        console.error("NPC Surgery failed:", e.message);
    }

    console.log("\n--- Object 28094 (Keldagrim Trapdoor) Surgery ---");
    try {
        const file = await cache.getFileById(cacheMajors.objects, 28094);
        if (file) {
            const def: any = (parse as any).object.read(file, cache);
            console.log("Def Name:", def.name);
            console.log("Extra (Params):", JSON.stringify(def.extra, null, 2));
        }
    } catch (e) {
        console.error("Object Surgery failed:", e.message);
    }

    console.log("\n--- Platypus 7015 Surgery ---");
    try {
        const file = await cache.getFileById(cacheMajors.npcs, 7015);
        if (file) {
            const def: any = (parse as any).npc.read(file, cache);
            console.log("Def Name:", def.name);
            console.log("Extra (Params):", JSON.stringify(def.extra, null, 2));
        }
    } catch (e) {
        console.error("Platypus Surgery failed:", e.message);
    }

    cache.close();
}

surgery();

