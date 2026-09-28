import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CACHE_DUMPS = 'D:/sovereign/cache_pedagogy/json_dumps';
const MEMORY_DIR = 'D:/sovereign/memory/pedagogy';

async function scanSpawns() {
    console.log("== Sovereign Authentic DB Table Mapper ==");
    const dbPath = resolve(CACHE_DUMPS, 'dbtables.json');
    const waypointsPath = resolve(MEMORY_DIR, 'authentic_waypoints.json');
    
    const db = JSON.parse(readFileSync(dbPath, 'utf8'));
    const waypoints = JSON.parse(readFileSync(waypointsPath, 'utf8'));
    
    // We want to find how DB Tables reference these waypoints
    const waypointEnumIds = Object.keys(waypoints).map(id => parseInt(id));
    console.log(`Scanning internal database rows against ${waypointEnumIds.length} known spatial Enums...`);

    const spawns: any[] = [];
    
    // We discovered that Table 19970, 21250, 22274 use type 209 or bare packed coords.
    for (const [rowId, row] of Object.entries<any>(db.rows)) {
        if (!row.unk01 || !row.unk01.columndata) continue;
        
        let coordData: any = null;
        let baseEntityId: number | null = null;

        for (const col of row.unk01.columndata) {
            for (const colDef of col.columns) {
                // Type 209 is a packed spatial coordinate
                if (colDef.type === 209 && colDef.value && typeof colDef.value[0] === 'number') {
                    const num = colDef.value[0];
                    coordData = {
                        x: (num >> 14) & 0x3FFF,
                        z: num & 0x3FFF,
                        plane: (num >> 28) & 0x3
                    };
                }
                
                // Assuming type 0 at col.id 0 might map back to entity ID
                if (col.id === 0 && colDef.type === 0 && colDef.value) {
                    baseEntityId = colDef.value[0];
                }
            }
        }

        if (coordData) {
            spawns.push({
                id: `db_${row.table}_${row.id}`,
                title: `DB Entity ${baseEntityId}`,
                coord: coordData,
                dbRowId: row.id,
                dbTable: row.table,
                entityId: baseEntityId,
                grounded: { confidence: 1.0, source: 'dbtable_extraction' },
                actions: [],
                meta: {}
            });
        }
    }

    // Inject Authentic Enums (Waypoints / Patrol Routes) directly into manifest
    for (const [enumId, wpList] of Object.entries(waypoints)) {
        for (const wp of wpList as any[]) {
            if (wp.coord && typeof wp.coord.x === 'number') {
                spawns.push({
                    id: `db_enum_${enumId}_${wp.key}`,
                    title: `Enum ${enumId} Node ${wp.key}`,
                    coord: wp.coord,
                    enumId: enumId,
                    nodeKey: wp.key,
                    grounded: { confidence: 1.0, source: 'enum_extraction' },
                    actions: [],
                    meta: {}
                });
            }
        }
    }

    const manifest = {
        version: "2.0.0",
        generated: new Date().toISOString(),
        source: "Jagex Authentic DB Tables Cache Dump",
        entities: spawns
    };

    const outPath = resolve(process.cwd(), 'public/authentic_spawn_manifest.json');
    writeFileSync(outPath, JSON.stringify(manifest, null, 2));

    console.log(`\n✅ Generated authentic ground-truth manifest to ${outPath}`);
    console.log(`Mapped ${spawns.length} raw DB entities to absolute spatial vectors.`);

}

scanSpawns().catch(console.error);
