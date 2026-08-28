import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";
import { RSMVCacheDB } from "../utils/RSMVCacheDB";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function materializeSpatialGrounding() {
    console.log("🚀 Initializing Sovereign Spatial Grounding Engine...");
    const source = new GameCacheLoader(CACHE_DIR);
    const db = new RSMVCacheDB();
    // await db.init(); // Constructor handles init

    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const arch = await source.getFileArchive(archInfo);
    console.log(`Loaded ${arch.length} DBRows. Starting extraction...`);

    let count = 0;
    for (const file of arch) {
        try {
            const row = parse.dbrows.read(file.buffer, source) as any;
            const tableId = row.tableId;
            if (!tableId) continue;

            const colGroups = [row.group1, row.group2, row.group3].filter(g => g && g.columndata);
            
            let entityId: number | null = null;
            let entityName: string | null = null;
            let coord: number | null = null;

            for (const group of colGroups) {
                for (const entry of group.columndata) {
                    const colId = entry.id;
                    const value = entry.columns?.[0]?.value;
                    const type = entry.columns?.[0]?.type;

                    if (tableId === 8961) { // NPCs
                        if (colId === 0) entityId = Number(value);
                        if (colId === 2) entityName = String(value);
                        if (colId === 4 && type === 33) coord = Number(value);
                    } else if (tableId === 39) { // POI / Mapzones
                        if (colId === 7) entityName = String(value);
                        if (colId === 0 && type === 33) coord = Number(value); // Col 0 is primary coord in Table 39
                        if (!entityId && colId === 6) entityId = Number(value);
                    }
                    // Generic spatial extraction for other tables
                    if (!coord && type === 33) coord = Number(value);
                    if (!entityName && type === 36) entityName = String(value);
                }
            }

            if (coord && coord > 0) {
                // Decode Jagex coord: plane << 28 | x << 14 | y
                const plane = (coord >> 28) & 0x3;
                const x = (coord >> 14) & 0x3FFF;
                const z = coord & 0x3FFF; // Jagex 'y' is Sovereign 'z' (height) or just horizontal coordinate?
                // In Runescape, (x, y) are horizontal, plane is vertical.
                // Sovereign uses (x, y, z) where y is altitude? No, RSMVCacheDB says z is height.
                
                db.insertGrounded({
                    entity_type: tableId === 8961 || tableId === 16130 ? 'npc' : 'object',
                    entity_id: entityId || file.fileid,
                    entity_name: entityName || undefined,
                    x: x,
                    y: z, // mapping RS y to Sovereign y
                    z: 0, // altitude unknown from dbrows
                    plane: plane,
                    zone_id: (x >> 6) << 8 | (z >> 6), // approximate zone_id (map square)
                    is_morphic: false,
                    has_actions: true,
                    learned_at: new Date().toISOString()
                });
                count++;
            }
        } catch (e) {
            // Skip decoding errors
        }
        
        if (count % 1000 === 0 && count > 0) {
            console.log(`Grounded ${count} entities...`);
        }
    }

    console.log(`✅ Sovereign Grounding Complete. Total entities grounded: ${count}`);
    source.close();
}

materializeSpatialGrounding().catch(console.error);
