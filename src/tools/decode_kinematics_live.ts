import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors } from '../constants';
import { parse } from '../opdecoder';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_DB = "C:\ProgramData\Jagex\RuneScape";
const MEMORY_DIR = "D:\\sovereign\\memory\\pedagogy";

const targetScripts = {
    mouse: [3009, 3495, 5067, 11839],
    cart: [1383],
    keldagrim: [3715, 5828, 7164]
};

const targetIds = {
    npc: [7015, 7016, 7017, 7018, 7019, 7020, 7021, 7022, 7023, 7024, 7025, 7026, 9304, 9305, 9306, 901, 3597, 3495],
    object: [28094, 637, 90898, 90899, 90900, 90901, 131591]
};

async function main() {
    console.log("== Live Cache Kinematic Parameter Decoder ==");
    const cache = new GameCacheLoader(CACHE_DB);

    const parsedMechanics = {
        carts: [] as any[],
        seekingNpcs: [] as any[]
    };

    const hasScriptBinding = (params: any, scriptIds: number[]) => {
        if (!params) return false;
        // params could be a Map or object depending on opcode_reader
        // In RS3 opdecoder, it's typically an object or Map
        let values: any[] = [];
        if (params instanceof Map) {
            values = Array.from(params.values());
        } else if (typeof params === 'object') {
            values = Object.values(params);
        }
        return values.some(val => typeof val === 'number' && scriptIds.includes(val));
    };

    // 1. Scan Objects (Mine Carts)
    console.log("Scanning Major 16 (Objects) for Cart definitions...");
    const objIndex = await cache.getCacheIndex(cacheMajors.objects);
    let objCount = 0;
    for (const entry of objIndex) {
        if (!entry) continue;
        try {
            const arch = await cache.getFileArchive(entry);
            for (const file of arch) {
                const def: any = (parse as any).objects.read(file.buffer, cache);
                if (!def) continue;

                const name = (def.name || "").toLowerCase();
                const id = file.fileid || entry.minor;
                const isCart = name.includes('cart') || name.includes('trapdoor') || targetIds.object.includes(id);

                if (isCart) {
                    const paramsObj = def.params instanceof Map ? Object.fromEntries(def.params) : (def.params || {});
                    parsedMechanics.carts.push({
                        id: id,
                        name: def.name,
                        options: def.options,
                        params: paramsObj,
                        CS2_Link: 'Inferred via Global Opcode Hook'
                    });
                }
            }
        } catch (e) {}
        objCount++;
    }

    // 2. Scan NPCs (Platypus / Mouse)
    console.log("Scanning Major 18 (NPCs) for Seekers...");
    const npcIndex = await cache.getCacheIndex(cacheMajors.npcs);
    let npcCount = 0;
    const seekingTerms = ['toy mouse', 'platypus', 'playtpus'];
    
    for (const entry of npcIndex) {
        if (!entry) continue;
        try {
            const arch = await cache.getFileArchive(entry);
            for (const file of arch) {
                const def: any = (parse as any).npcs.read(file.buffer, cache);
                if (!def) continue;

                const name = (def.name || "").toLowerCase();
                const id = file.fileid || entry.minor;
                const isTerm = seekingTerms.some(t => name.includes(t)) || targetIds.npc.includes(id);

                if (isTerm) {
                    const paramsObj = def.params instanceof Map ? Object.fromEntries(def.params) : (def.params || {});
                    parsedMechanics.seekingNpcs.push({
                        id: id,
                        name: def.name,
                        options: def.options,
                        walkSpeed: def.walkSpeed, 
                        walkRange: def.walkBoundary || def.walkRange, 
                        models: def.models,
                        params: paramsObj,
                        CS2_Link: 'Inferred via Global Opcode Hook'
                    });
                }
            }
        } catch (e) {}
        npcCount++;
        if (npcCount % 5000 === 0) console.log(`Processed ${npcCount} NPCs...`);
    }

    const outPath = path.resolve(MEMORY_DIR, 'kinematic_mechanics_live.json');
    fs.writeFileSync(outPath, JSON.stringify(parsedMechanics, null, 2));

    console.log(`\n✅ Live Cache Kinematic Vector mapping complete.`);
    console.log(`Extracted mechanics for ${parsedMechanics.carts.length} Cart nodes and ${parsedMechanics.seekingNpcs.length} Seeking NPCs.`);
    console.log(`Saved output to ${outPath}`);

    cache.close();
}

main().catch(console.error);

