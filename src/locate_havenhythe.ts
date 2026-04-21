import { GameCacheLoader } from "./cache/sqlite";
import { cacheMajors, cacheConfigPages } from "./constants";
import { parse } from "./opdecoder";

async function locateHavenhythe() {
    const loader = new GameCacheLoader("C:\ProgramData\Jagex\RuneScape");
    const dbArchIndex = (await loader.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const dbArch = await loader.getFileArchive(dbArchIndex);
    
    console.log("Searching DBRows for NPC 1556 (Avatar) or coords near Havenhythe...");
    
    for (const file of dbArch) {
        try {
            const row = parse.dbrows.read(file.buffer, loader) as any;
            const colGroups = row.unk01?.columndata || row.unk02?.columndata;
            if (!colGroups) continue;

            let coord: number | null = null, name = "", npcId = 0;
            for (const group of colGroups) {
                for (const col of group.columns) {
                    if (col.type === 36) name = String(col.value?.[0] || "");
                    if (col.type === 32) npcId = Number(col.value?.[0] || 0);
                    if (col.type === 33 || col.type === 22) if (col.value?.[0] !== undefined) coord = Number(col.value[0]);
                }
            }

            if (npcId === 1556) {
                console.log(`🌟 FOUND AVATAR (1556) in DBRow file ${file.fileid}`);
                if (coord !== null) {
                    const x = (coord >> 14) & 0x3FFF, y = coord & 0x3FFF, p = (coord >> 28);
                    console.log(`   Coordinates: ${x}, ${y}, plane ${p}`);
                    console.log(`   Region: rx ${x >> 6}, ry ${y >> 6}`);
                }
            }
            
            // Look for any coord in the roughly 58, 52 area
            if (coord !== null) {
                const x = (coord >> 14) & 0x3FFF, y = coord & 0x3FFF;
                const rx = x >> 6, ry = y >> 6;
                if (rx >= 50 && rx <= 65 && ry >= 45 && ry <= 60) {
                     // console.log(`   Nearby NPC [${npcId}]: ${name} @ ${x}, ${y} [${rx}, ${ry}]`);
                }
            }
        } catch (e) {}
    }
    loader.close();
}

locateHavenhythe().catch(console.error);

