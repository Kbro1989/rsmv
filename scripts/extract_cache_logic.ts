import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CACHE_DUMPS = 'D:/sovereign/cache_pedagogy/json_dumps';
const MEMORY_DIR = 'D:/sovereign/memory/pedagogy';

interface VarbitDef {
    id: number;
    baseVar: number;
    startBit: number;
    endBit: number;
}

async function extractVarbits() {
    console.log("== Sovereign Varbit Preservation ==");
    const varbitsPath = resolve(MEMORY_DIR, 'varbits.json');
    let varbits: Record<string, VarbitDef>;
    try {
        varbits = JSON.parse(readFileSync(varbitsPath, 'utf8'));
    } catch (e) {
        console.warn("Could not find varbits.json in cache dumps.");
        return;
    }

    const compiledVarbits: any[] = [];
    for (const [idStr, def] of Object.entries(varbits)) {
        compiledVarbits.push({
            id: parseInt(idStr),
            baseVar: def.baseVar,
            startBit: def.startBit,
            endBit: def.endBit,
        });
    }

    const outPath = resolve(MEMORY_DIR, 'varbits_filled.json');
    writeFileSync(outPath, JSON.stringify({ varbits: compiledVarbits, metadata: { total: compiledVarbits.length, timestamp: Date.now() } }, null, 2));
    console.log(`✅ Filled varbit bins! Extracted ${compiledVarbits.length} authentic varbits to ${outPath}`);
}

async function extractSpawnsAndWaypoints() {
    console.log("== Sovereign Kinematic Waypoint & Spawn Extractor ==");
    const enumsPath = resolve(CACHE_DUMPS, 'enums.json');
    const enums = JSON.parse(readFileSync(enumsPath, 'utf8'));

    const waypoints: Record<string, any[]> = {};
    for (const [id, def] of Object.entries<any>(enums)) {
        if (!def.map) continue;
        const values = Object.values(def.map);
        if (values.length > 0 && values.some(v => typeof v === 'number' && v > 10000000 && v < 2000000000)) {
            // These are authentic packed (plane << 28) | (x << 14) | z Vectors!
            const decoded = Object.entries(def.map).map(([k, v]: [string, any]) => {
                const num = typeof v === 'number' ? v : parseInt(v);
                return {
                    key: k,
                    raw: num,
                    coord: {
                        x: (num >> 14) & 0x3FFF,
                        z: num & 0x3FFF,
                        plane: (num >> 28) & 0x3
                    }
                };
            });
            waypoints[id] = decoded;
        }
    }

    const outPath = resolve(MEMORY_DIR, 'authentic_waypoints.json');
    writeFileSync(outPath, JSON.stringify(waypoints, null, 2));
    console.log(`✅ Extracted ${Object.keys(waypoints).length} authentic coordinate enums (vectors/waypoints) to ${outPath}`);
}

async function main() {
    await extractVarbits();
    await extractSpawnsAndWaypoints();
}
main().catch(console.error);
