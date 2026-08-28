import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheMapFiles } from "../constants";
import { parse } from "../opdecoder";
import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const OUTPUT_DIR = "D:\\sovereign\\atlas\\spatial\\hav_58_52";
const MEMORY_DIR = "D:\\sovereign\\memory\\pedagogy";

// Havenhythe map region (58, 52)
const HAV_REGIONS = [
    { rx: 58, ry: 52 },
];

// Expand to neighboring regions for full town coverage
const HAV_REGIONS_EXTENDED = [
    { rx: 57, ry: 51 }, { rx: 58, ry: 51 }, { rx: 59, ry: 51 },
    { rx: 57, ry: 52 }, { rx: 58, ry: 52 }, { rx: 59, ry: 52 },
    { rx: 57, ry: 53 }, { rx: 58, ry: 53 }, { rx: 59, ry: 53 },
];

interface GroundedEntity {
    type: "npc" | "object";
    id: number;
    name: string;
    x: number;
    y: number;
    plane: number;
    rotation?: number;
    locType?: number;
    actions?: string[];
    modelIds?: number[];
}

function wikiUrl(name: string): string {
    if (!name || name === "null" || name === "Hidden") return "";
    return `https://runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}

async function synthesize() {
    console.log("🧬⚡ Starting Havenhythe (58, 52) Full Synthesis...");
    const source = new GameCacheLoader(CACHE_DIR);

    const groundedEntities: GroundedEntity[] = [];
    const uniqueModelIds = new Set<number>();
    let regionsFound = 0;
    let regionsSkipped = 0;

    // ── PASS 1: Scan mapsquare locations for ALL objects in Havenhythe region ──
    console.log("\n📍 Pass 1: Scanning Mapsquares for Locations...");
    const msIndex = await source.getCacheIndex(cacheMajors.mapsquares);

    for (const region of HAV_REGIONS_EXTENDED) {
        const archId = (region.rx << 8) | region.ry;
        const archInfo = msIndex[archId];
        if (!archInfo) {
            console.log(`  Region [${region.rx}, ${region.ry}] (Archive ${archId}): NOT FOUND in cache index.`);
            regionsSkipped++;
            continue;
        }

        console.log(`  Region [${region.rx}, ${region.ry}] (Archive ${archId}): Found. Sub-indices: [${archInfo.subindices?.join(', ')}]`);
        regionsFound++;

        try {
            const arch = await source.getFileArchive(archInfo);
            console.log(`    Sub-files present: [${arch.map(f => f.fileid).join(', ')}]`);

            // Try standard locations (sub-file 0)
            const locFile = arch.find(f => f.fileid === cacheMapFiles.locations);

            if (locFile) {
                console.log(`    Found locations sub-file (id=0), size=${locFile.buffer.byteLength} bytes`);
                try {
                    const locs = parse.mapsquareLocations.read(locFile.buffer, source);
                    for (const loc of locs.locations) {
                        for (const use of loc.uses) {
                            const worldX = (region.rx * 64) + use.x;
                            const worldY = (region.ry * 64) + use.y;
                            groundedEntities.push({
                                type: "object",
                                id: loc.id,
                                name: "",
                                x: worldX,
                                y: worldY,
                                plane: use.plane,
                                rotation: use.rotation,
                                locType: use.type,
                            });
                        }
                    }
                    console.log(`    Decoded ${locs.locations.length} location entries.`);
                } catch (e: any) {
                    console.log(`    Failed to decode locations: ${e.message}`);
                }
            } else {
                console.log(`    No standard locations sub-file (id=0).`);
            }

            // Try NXT tiles (sub-file 5) for diagnostic
            const nxtFile = arch.find(f => f.fileid === cacheMapFiles.square_nxt);
            if (nxtFile) {
                console.log(`    Found NXT sub-file (id=5), size=${nxtFile.buffer.byteLength} bytes`);
                try {
                    const nxtData = parse.mapsquareTilesNxt.read(nxtFile.buffer, source);
                    console.log(`    NXT tile data decoded. Keys: [${Object.keys(nxtData).join(', ')}]`);
                    // Check if NXT contains location data
                    if ((nxtData as any).locations) {
                        const nxtLocs = (nxtData as any).locations;
                        console.log(`    NXT contains ${nxtLocs.length} embedded locations!`);
                        for (const loc of nxtLocs) {
                            for (const use of (loc.uses || [])) {
                                const worldX = (region.rx * 64) + use.x;
                                const worldY = (region.ry * 64) + use.y;
                                groundedEntities.push({
                                    type: "object",
                                    id: loc.id,
                                    name: "",
                                    x: worldX,
                                    y: worldY,
                                    plane: use.plane,
                                    rotation: use.rotation,
                                    locType: use.type,
                                });
                            }
                        }
                    }
                } catch (e: any) {
                    console.log(`    Failed to decode NXT: ${e.message}`);
                }
            }

        } catch (e: any) {
            console.log(`    Archive read failed: ${e.message}`);
        }
    }

    console.log(`\n📊 Pass 1 Summary: ${regionsFound} regions found, ${regionsSkipped} skipped.`);
    console.log(`   ${groundedEntities.length} raw object placements discovered.`);

    if (groundedEntities.length === 0) {
        console.log("\n⚠️ No location data found. Dumping diagnostic info...");
        console.log("   This may mean Havenhythe uses a different region scheme.");
        console.log("   Check the RS wiki for the correct mapsquare coordinates.");
        source.close();
        return;
    }

    // ── PASS 2: Resolve Object Names + Model IDs from Major 16 (objects) ──
    console.log("\n📖 Pass 2: Resolving Object Names and Model IDs...");
    const uniqueObjectIds = [...new Set(groundedEntities.filter(e => e.type === "object").map(e => e.id))];
    console.log(`   Resolving ${uniqueObjectIds.length} unique object IDs...`);

    const objectInfoMap = new Map<number, { name: string; actions: string[]; models: number[] }>();

    for (const oid of uniqueObjectIds) {
        try {
            const file = await source.getFileById(cacheMajors.objects, oid);
            if (file) {
                const obj = parse.object.read(file, source) as any;
                const name = obj.name || "";
                const actions: string[] = [];
                if (obj.options) {
                    for (const opt of obj.options) {
                        if (opt && !opt.startsWith("null")) actions.push(opt);
                    }
                }
                // Collect model IDs
                const models: number[] = [];
                if (obj.models) {
                    for (const m of obj.models) {
                        if (m && Array.isArray(m.values)) {
                            for (const val of m.values) {
                                if (typeof val === "number") {
                                    models.push(val);
                                    uniqueModelIds.add(val);
                                }
                            }
                        } else if (m && typeof m.id === "number") {
                            models.push(m.id);
                            uniqueModelIds.add(m.id);
                        } else if (typeof m === "number") {
                            models.push(m);
                            uniqueModelIds.add(m);
                        }
                    }
                }
                objectInfoMap.set(oid, { name, actions, models });
            }
        } catch (e) { /* skip */ }
    }

    // Apply names and model IDs
    for (const entity of groundedEntities) {
        if (entity.type === "object") {
            const info = objectInfoMap.get(entity.id);
            if (info) {
                entity.name = info.name;
                entity.actions = info.actions;
                entity.modelIds = info.models;
            }
        }
    }

    // Filter significant entities
    const significantEntities = groundedEntities.filter(e =>
        e.name && e.name !== "" && e.name !== "null" && e.name !== "Hidden"
    );

    // ── BUILD FINAL OUTPUT ──
    const output = {
        city: "Havenhythe",
        metadata: {
            synthesized_at: new Date().toISOString(),
            source: "Sovereign Cache Grounding — rsmv_inspector",
            region: { rx: 58, ry: 52 },
            region_id: (58 << 8) | 52,
            total_raw_placements: groundedEntities.length,
            total_significant_entities: significantEntities.length,
            total_unique_models: uniqueModelIds.size,
            total_unique_objects: uniqueObjectIds.length,
        },
        entities: significantEntities,
        unique_model_ids: [...uniqueModelIds].sort((a, b) => a - b),
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(MEMORY_DIR, { recursive: true });

    const logicPath = path.join(OUTPUT_DIR, "havenhythe_synthesis.json");
    const memoryPath = path.join(MEMORY_DIR, "havenhythe_synthesis.json");

    fs.writeFileSync(logicPath, JSON.stringify(output, null, 2));
    fs.writeFileSync(memoryPath, JSON.stringify(output, null, 2));

    console.log(`\n✅ Synthesis Complete!`);
    console.log(`   📄 Atlas:  ${logicPath}`);
    console.log(`   📄 Memory: ${memoryPath}`);
    console.log(`   📊 Raw Placements: ${groundedEntities.length}`);
    console.log(`   🏗️ Significant Entities: ${significantEntities.length}`);
    console.log(`   🎨 Unique Model IDs: ${uniqueModelIds.size}`);

    // Log top named objects
    const nameCounts = new Map<string, number>();
    for (const e of significantEntities) {
        nameCounts.set(e.name, (nameCounts.get(e.name) || 0) + 1);
    }
    const topNames = [...nameCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log(`\n🏛️ Top 20 Named Objects:`);
    for (const [name, count] of topNames) {
        console.log(`   ${count}x ${name}`);
    }

    source.close();
}

synthesize().catch(console.error);


