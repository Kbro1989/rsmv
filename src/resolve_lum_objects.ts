import * as fs from 'fs';
import { GameCacheLoader } from './cache/sqlite';
import { cacheMajors } from './constants';
import { parse } from './opdecoder';

async function resolveLumbridgeObjects() {
    const data = JSON.parse(fs.readFileSync("D:\\Users\\POG2\\Desktop\\pog-vibe-interactive\\files\\public\\ms_50_50.json", 'utf-8'));
    const cache = new GameCacheLoader("C:\ProgramData\Jagex\RuneScape");

    console.log("[GODHEAD] Resolving Object Names for ms_50_50...");

    const uniqueIds = Array.from(new Set(data.objects.map((o: any) => Number(o.objectId))));

    for (const id of (uniqueIds as number[])) {
        try {
            // Major 16 is for RS Objects (Locs)
            const objEntry = await cache.getIndexEntryById(cacheMajors.objects, id);
            if (!objEntry) continue;

            const arch = await cache.getFileArchive(objEntry);
            const file = arch[0];
            const def: any = (parse as any).objects.read(file.buffer, cache);

            const options = (def.options || []).join(",").toLowerCase();
            const name = (def.name || "").toLowerCase();

            // Log if it matches transition signatures
            if (options.includes("climb") || options.includes("enter") || options.includes("open") || options.includes("down") || options.includes("up")) {
                console.log(`[PORTAL] ID: ${id} | Name: ${def.name} | Options: ${options}`);
            }
        } catch (e) { }
    }

    cache.close();
}

resolveLumbridgeObjects();

