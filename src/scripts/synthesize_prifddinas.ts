import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages, cacheMapFiles } from "../constants";
import { parse } from "../opdecoder";
import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const OUTPUT_DIR = "D:\\sovereign\\cache_pedagogy\\rsmv_inspector\\src\\logic";
const MEMORY_DIR = "D:\\sovereign\\memory\\pedagogy";

// Prifddinas map region bounds (Major 5 / mapsquares)
const PRIF_REGIONS = [
    { rx: 25, ry: 162 }, { rx: 26, ry: 162 }, { rx: 27, ry: 162 },
    { rx: 25, ry: 163 }, { rx: 26, ry: 163 }, { rx: 27, ry: 163 },
    { rx: 25, ry: 164 }, { rx: 26, ry: 164 }, { rx: 27, ry: 164 },
];

// Prifddinas keyword filters
const PRIF_KEYWORDS = [
    "amlodd", "crwys", "cadarn", "hefin", "iorwerth", "ithell", "meilyr", "trahaearn",
    "morvran", "max guild", "seren", "prifddinas", "crystal tree", "clan", "voice of seren",
    "crystal chest", "crystal flagon", "harmonic dust", "bonfire", "summoning obelisk",
    "crystal shapeshifter", "elf", "elven", "crystal hatchet", "attuned crystal",
    "crystal fishing rod", "harps", "harping"
];

// Known clan-to-district mapping
const CLAN_DISTRICTS: Record<string, { direction: string; skills: string[]; anchor_id: number; coords: { x: number; y: number } }> = {
    "Iorwerth": { direction: "North", skills: ["Slayer", "Prayer"], anchor_id: 92538, coords: { x: 1696, y: 10464 } },
    "Hefin": { direction: "North-East", skills: ["Agility", "Prayer"], anchor_id: 92541, coords: { x: 1712, y: 10464 } },
    "Amlodd": { direction: "East", skills: ["Summoning", "Divination"], anchor_id: 92540, coords: { x: 1712, y: 10448 } },
    "Ithell": { direction: "South-East", skills: ["Crafting", "Construction"], anchor_id: 92539, coords: { x: 1712, y: 10432 } },
    "Meilyr": { direction: "South", skills: ["Dungeoneering", "Herblore"], anchor_id: 92536, coords: { x: 1696, y: 10432 } },
    "Crwys": { direction: "South-West", skills: ["Farming", "Woodcutting"], anchor_id: 92533, coords: { x: 1680, y: 10432 } },
    "Cadarn": { direction: "West", skills: ["Ranged", "Magic"], anchor_id: 92534, coords: { x: 1680, y: 10448 } },
    "Trahaearn": { direction: "North-West", skills: ["Mining", "Smithing"], anchor_id: 92535, coords: { x: 1680, y: 10464 } },
};

interface GroundedEntity {
    type: "npc" | "object";
    id: number;
    name: string;
    x: number;
    y: number;
    plane: number;
    rotation?: number; // object only
    locType?: number;  // object only
    actions?: string[];
    district?: string;
    wikiUrl?: string;
}

/** Generate RS Wiki URL for a named entity (matches WikiEnricher.ts pattern) */
function wikiUrl(name: string): string {
    if (!name || name === "null" || name === "Hidden") return "";
    return `https://runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}

interface DistrictData {
    clan: string;
    direction: string;
    skills: string[];
    anchor_id: number;
    coords: { x: number; y: number };
    npcs: GroundedEntity[];
    objects: GroundedEntity[];
    activities: string[];
}

function assignDistrict(x: number, y: number): string | undefined {
    // Prifddinas is a rough octagon centered at (1696, 10448)
    // District assignment based on angular position from center
    const cx = 1696, cy = 10448;
    const dx = x - cx, dy = y - cy;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Normalize angle to [0, 360)
    const norm = ((angle % 360) + 360) % 360;

    if (norm >= 337.5 || norm < 22.5) return "Amlodd";       // East
    if (norm >= 22.5 && norm < 67.5) return "Hefin";          // NE
    if (norm >= 67.5 && norm < 112.5) return "Iorwerth";      // North
    if (norm >= 112.5 && norm < 157.5) return "Trahaearn";     // NW
    if (norm >= 157.5 && norm < 202.5) return "Cadarn";        // West
    if (norm >= 202.5 && norm < 247.5) return "Crwys";         // SW
    if (norm >= 247.5 && norm < 292.5) return "Meilyr";        // South
    if (norm >= 292.5 && norm < 337.5) return "Ithell";        // SE
    return undefined;
}

async function synthesize() {
    console.log("🧬⚡ Starting Prifddinas Full Synthesis...");
    const source = new GameCacheLoader(CACHE_DIR);

    const groundedEntities: GroundedEntity[] = [];
    const collisionMatrix: Record<string, number> = {};

    // ── PASS 1: Scan mapsquare locations for ALL objects in Prifddinas region ──
    console.log("\n📍 Pass 1: Scanning Mapsquares for Locations and Terrain Collision...");
    const msIndex = await source.getCacheIndex(cacheMajors.mapsquares);

    for (const region of PRIF_REGIONS) {
        const archId = (region.rx << 8) | region.ry;
        const archInfo = msIndex[archId];
        if (!archInfo) continue;

        console.log(`  Region [${region.rx}, ${region.ry}] (Archive ${archId})...`);
        const arch = await source.getFileArchive(archInfo);
        const locFile = arch.find(f => f.fileid === cacheMapFiles.locations);
        const tileFile = arch.find(f => f.fileid === cacheMapFiles.squares);

        if (tileFile) {
            try {
                // Use standard parser: 16384 flat tiles (4 levels * 64 * 64) with build-conditioned height fields
                const tilesData = parse.mapsquareTiles.read(tileFile.buffer, source, { buildnr: 927 });
                const stride = 64;
                const tilesPerLevel = 64 * 64;

                for (let plane = 0; plane < 4; plane++) {
                    for (let ty = 0; ty < 64; ty++) {
                        for (let tx = 0; tx < 64; tx++) {
                            const tileIndex = (plane * tilesPerLevel) + (ty * stride) + tx;
                            const tile = tilesData.tiles?.[tileIndex];
                            if (!tile) continue;

                            const settings = tile.settings ?? 0;
                            // Bit 0x01 in settings = blocked tile 
                            if (settings & 1) {
                                const worldX = (region.rx * 64) + tx;
                                const worldY = (region.ry * 64) + ty;
                                const key = `${plane}_${worldX}_${worldY}`;
                                collisionMatrix[key] = (collisionMatrix[key] || 0) | 0x200000;
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`  [ERR] Failed to parse terrain for Archive ${archId}: ${e}`);
            }
        }

        if (!locFile) continue;

        try {
            const locs = parse.mapsquareLocations.read(locFile.buffer, source);
            for (const loc of locs.locations) {
                for (const use of loc.uses) {
                    const worldX = (region.rx * 64) + use.x;
                    const worldY = (region.ry * 64) + use.y;
                    groundedEntities.push({
                        type: "object",
                        id: loc.id,
                        name: "", // Will be resolved in Pass 3
                        x: worldX,
                        y: worldY,
                        plane: use.plane,
                        rotation: use.rotation,
                        locType: use.type,
                    });
                }
            }
        } catch (e) { /* skip */ }
    }

    console.log(`  Found ${groundedEntities.length} raw object placements in Prifddinas regions.`);
    console.log(`  Terraformed Terrain Collision Size: ${Object.keys(collisionMatrix).length}`);

    // ── PASS 2: Resolve Object Names from Major 16 (objects) ──
    console.log("\n📖 Pass 2: Resolving Object Names...");
    const uniqueObjectIds = [...new Set(groundedEntities.filter(e => e.type === "object").map(e => e.id))];
    console.log(`  Resolving ${uniqueObjectIds.length} unique object IDs...`);

    const objectNameMap = new Map<number, { name: string; actions: string[]; width: number; length: number; solid: boolean }>();

    for (const oid of uniqueObjectIds) {
        try {
            const file = await source.getFileById(cacheMajors.objects, oid);
            if (file) {
                const obj = parse.object.read(file, source) as any;
                const name = obj.name || "";
                if (oid % 100 === 0) console.log(`  [DBG] Object ${oid} -> name: ${name}, solid: ${!(obj.probably_nocollision === true)}`);
                const width = obj.width ?? 1;
                const length = obj.length ?? 1;
                const solid = !(obj.probably_nocollision === true);

                const actions: string[] = [];
                if (obj.options) {
                    for (const opt of obj.options) {
                        if (opt && !opt.startsWith("null")) actions.push(opt);
                    }
                }
                objectNameMap.set(oid, { name, actions, width, length, solid });
            }
        } catch (e) { /* skip */ }
    }

    // Apply names and collisions
    let resolvedCount = 0;
    let emptyNames = 0;
    let nullNames = 0;
    let hiddenNames = 0;
    const sampleNames: string[] = [];
    
    for (const entity of groundedEntities) {
        if (entity.type === "object") {
            const info = objectNameMap.get(entity.id);
            if (info) {
                entity.name = info.name;
                entity.actions = info.actions;
                
                // Add Object collision to the Matrix (22 = floor decoration, typically not solid)
                if (info.solid && entity.locType !== undefined && entity.locType !== 22) {
                    let sizeX = info.width;
                    let sizeY = info.length;
                    if (entity.rotation === 1 || entity.rotation === 3) {
                        sizeX = info.length;
                        sizeY = info.width;
                    }
                    for (let sx = 0; sx < sizeX; sx++) {
                        for (let sy = 0; sy < sizeY; sy++) {
                            const key = `${entity.plane}_${entity.x + sx}_${entity.y + sy}`;
                            collisionMatrix[key] = (collisionMatrix[key] || 0) | 0x100;
                        }
                    }
                }

                resolvedCount++;
                if (!info.name || info.name === "") emptyNames++;
                else if (info.name === "null") nullNames++;
                else if (info.name === "Hidden") hiddenNames++;
                else if (sampleNames.length < 30) sampleNames.push(`${entity.id}:${info.name}`);
            }
        }
    }
    console.log(`  Name Resolution: ${resolvedCount}/${groundedEntities.length} resolved`);
    console.log(`  Empty: ${emptyNames}, Null: ${nullNames}, Hidden: ${hiddenNames}`);
    console.log(`  Named: ${resolvedCount - emptyNames - nullNames - hiddenNames}`);
    console.log(`  Samples: ${sampleNames.join(", ")}`);

    // ── PASS 3: Find NPCs via DBRow scan (NPC Spawns Table) ──
    console.log("\n🧪 Pass 3: Scanning DBRows for NPC Spawns in Prifddinas coordinates...");
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const dbArch = await source.getFileArchive(archInfo);

    // Prifddinas world coordinate range
    // Region (25-27, 162-164) → World X: 1600-1792, World Y: 10368-10560
    const PRIF_WX_MIN = 1600, PRIF_WX_MAX = 1792;
    const PRIF_WY_MIN = 10368, PRIF_WY_MAX = 10560;

    let npcCount = 0;
    for (const file of dbArch) {
        try {
            const row = parse.dbrows.read(file.buffer, source) as any;
            const colGroups = row.unk01?.columndata || row.unk02?.columndata;
            if (!colGroups) continue;

            let coord: number | null = null;
            let name = "";
            let npcId = 0;

            for (const group of colGroups) {
                for (const col of group.columns) {
                    if (col.type === 36) name = String(col.value?.[0] || "");
                    if (col.type === 32) npcId = Number(col.value?.[0] || 0);
                    if (col.type === 33 || col.type === 22) {
                        if (col.value?.[0] !== undefined) coord = Number(col.value[0]);
                    }
                }
            }

            if (coord !== null) {
                const x = (coord >> 14) & 0x3FFF;
                const y = coord & 0x3FFF;
                const plane = (coord >> 28);

                // Sample first 5 to see what coords we're getting
                if (npcCount < 5 && x > 0 && y > 0) {
                    console.log(`    DBRow NPC Sample [${npcId}]: ${name} @ ${x}, ${y}, plane ${plane}`);
                }

                if (x >= PRIF_WX_MIN && x <= PRIF_WX_MAX && y >= PRIF_WY_MIN && y <= PRIF_WY_MAX) {
                    npcCount++;
                    groundedEntities.push({
                        type: "npc",
                        id: npcId,
                        name: name || `NPC_${npcId}`,
                        x, y, plane,
                    });
                }
            }
        } catch (e) { /* skip */ }
    }
    console.log(`  Found ${npcCount} NPC spawns within Prifddinas coordinate bounds.`);

    // ── PASS 4: Resolve NPC names from Major 9 (npcs) ──
    console.log("\n📖 Pass 4: Resolving NPC Names...");
    const npcEntities = groundedEntities.filter(e => e.type === "npc" && (!e.name || e.name.startsWith("NPC_")));
    const uniqueNpcIds = [...new Set(npcEntities.map(e => e.id))];

    for (const nid of uniqueNpcIds) {
        try {
            const file = await source.getFileById(cacheMajors.npcs, nid);
            if (file) {
                const npc = parse.npc.read(file, source) as any;
                if (npc.name) {
                    for (const entity of groundedEntities) {
                        if (entity.type === "npc" && entity.id === nid && (!entity.name || entity.name.startsWith("NPC_"))) {
                            entity.name = npc.name;
                            if (npc.options) {
                                entity.actions = npc.options.filter((o: string) => o && !o.startsWith("null"));
                            }
                        }
                    }
                }
            }
        } catch (e) { /* skip */ }
    }

    // ── PASS 5: Build District Synthesis + Wiki Cross-References ──
    console.log("\n🏛️ Pass 5: Synthesizing District Data + Wiki Cross-References...");

    // Filter out unnamed or hidden objects
    const significantEntities = groundedEntities.filter(e => {
        if (!e.name || e.name === "" || e.name === "null" || e.name === "Hidden") return false;
        return true;
    });

    // Assign districts and wiki cross-references
    for (const entity of significantEntities) {
        entity.district = assignDistrict(entity.x, entity.y);
        entity.wikiUrl = wikiUrl(entity.name);
    }

    // Build district data
    const districts: Record<string, DistrictData> = {};
    for (const [clan, info] of Object.entries(CLAN_DISTRICTS)) {
        districts[clan] = {
            ...info,
            clan,
            npcs: significantEntities.filter(e => e.type === "npc" && e.district === clan),
            objects: significantEntities.filter(e => e.type === "object" && e.district === clan),
            activities: [],
        };

        // Deduce activities from object actions
        const uniqueActions = new Set<string>();
        for (const obj of districts[clan].objects) {
            if (obj.actions) {
                for (const action of obj.actions) {
                    uniqueActions.add(action);
                }
            }
        }
        districts[clan].activities = [...uniqueActions];
    }

    // Center entities (Tower of Voices, Lodestone, etc.)
    const centerEntities = significantEntities.filter(e => !e.district);

    // ── BUILD FINAL OUTPUT ──
    const output = {
        city: "Prifddinas",
        metadata: {
            synthesized_at: new Date().toISOString(),
            origin: "Tower of Voices",
            center: { x: 1696, y: 10448 },
            plane: 0,
            source: "Sovereign Cache Grounding + Deep Synthesis",
            total_entities: significantEntities.length,
            total_npcs: significantEntities.filter(e => e.type === "npc").length,
            total_objects: significantEntities.filter(e => e.type === "object").length,
        },
        anchors: {
            center: { name: "Tower of Voices", id: 92537, coords: { x: 1696, y: 10448, z: 0 }, wikiUrl: wikiUrl("Tower of Voices") },
            lodestone: { name: "Prifddinas Lodestone", id: 93371, coords: { x: 1696, y: 10432, z: 0 }, wikiUrl: wikiUrl("Prifddinas lodestone") },
            fairy_ring_djs: { id: 92531, coords: { x: 1664, y: 10464, z: 0 }, wikiUrl: wikiUrl("Fairy ring") },
        },
        vos_logic: {
            description: "Varbit 19147 state-tracking for Voice of Seren. Two clans are active per hour.",
            varbit: 19147,
            wikiUrl: wikiUrl("Voice of Seren"),
            state_map: {
                "1": ["Iorwerth", "Ithell"],
                "2": ["Ithell", "Cadarn"],
                "3": ["Cadarn", "Amlodd"],
                "4": ["Amlodd", "Trahaearn"],
                "5": ["Trahaearn", "Hefin"],
                "6": ["Hefin", "Crwys"],
                "7": ["Crwys", "Meilyr"],
                "8": ["Meilyr", "Iorwerth"],
            },
            effects: "VoS grants 20% bonus XP in the clan's associated skills and enables special interactions.",
        },
        requirements: {
            quest_gate: "Plague's End",
            quest_id: 302,
            wikiUrl: wikiUrl("Plague's End"),
        },
        meta: {
            title: "Prifddinas Sovereign Pedagogical Mapping",
            description: "Extracted Clan Districts, Anchor Voicestones, Grounded Entities, and Regional Collision Matrix",
            bounds: { wx_min: PRIF_WX_MIN, wx_max: PRIF_WX_MAX, wy_min: PRIF_WY_MIN, wy_max: PRIF_WY_MAX },
            regions: PRIF_REGIONS,
        },
        districts,
        center_entities: centerEntities,
        collision_matrix: collisionMatrix,
    };

    const logicPath = path.join(OUTPUT_DIR, "prifddinas_logic.json");
    const memoryPath = path.join(MEMORY_DIR, "prifddinas_synthesis.json");

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(MEMORY_DIR, { recursive: true });

    fs.writeFileSync(logicPath, JSON.stringify(output, null, 2));
    fs.writeFileSync(memoryPath, JSON.stringify(output, null, 2));

    console.log(`\n✅ Synthesis Complete!`);
    console.log(`   📄 Logic: ${logicPath}`);
    console.log(`   📄 Memory: ${memoryPath}`);
    console.log(`   📊 Total Entities: ${significantEntities.length}`);
    console.log(`   🧑 NPCs: ${output.metadata.total_npcs}`);
    console.log(`   🏗️ Objects: ${output.metadata.total_objects}`);
    for (const [clan, data] of Object.entries(districts)) {
        console.log(`   🏛️ ${clan}: ${data.npcs.length} NPCs, ${data.objects.length} Objects, ${data.activities.length} activities`);
    }

    source.close();
}

synthesize().catch(console.error);

