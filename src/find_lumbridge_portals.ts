import { GameCacheLoader } from './cache/sqlite';
import { cacheMajors } from './constants';
import { parse } from './opdecoder';

async function findLumbridgePortals() {
    const cache = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    console.log("[GODHEAD] Identifying Lumbridge Portal Signatures...");

    const entry = await cache.getIndexEntryById(255, cacheMajors.objects);
    const arch = await cache.getFileArchive(entry);

    for (const file of arch) {
        try {
            const def = (parse as any).objects.read(file.buffer, cache);
            const name = def.name?.toLowerCase() || "";
            const options = (def.options || []).join(",").toLowerCase();

            // Looking for transition portals
            if ((name.includes("lumbridge") || name.includes("trapdoor") || name.includes("stair")) && 
                (options.includes("climb-down") || options.includes("open") || options.includes("enter"))) {
                console.log(`[PORTAL FOUND] ID: ${file.fileid} | Name: ${def.name} | Options: ${options}`);
                // Check for linked varbits/configs
                if (def.varbit) console.log(`  -> Logic Bridge: Varbit ${def.varbit}`);
            }
        } catch (e) {}
    }

    cache.close();
}

findLumbridgePortals();
