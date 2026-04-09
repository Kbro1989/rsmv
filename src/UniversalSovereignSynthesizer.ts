import { GameCacheLoader } from "./cache/sqlite";
import { cacheMajors, cacheConfigPages } from "./constants";
import { parse } from "./opdecoder";
import * as fs from "fs";
import * as path from "path";

/**
 * UniversalSovereignSynthesizer.ts
 * 
 * THE ULTIMATE 1:1 TRUTH ENGINE
 * Goal: Recursively extract every cache asset (4 planes, NPCs, Objects) 
 * and enrich them with Wiki metadata & existing Pedagogy manifests.
 */

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";
const OUTPUT_DIR = "D:\\sovereign\\atlas\\spatial\\world_extract";
const MEMORY_DIR = "D:\\sovereign\\memory\\pedagogy\\manifests";

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
    wikiUrl?: string;
    examine?: string;
}

export class UniversalSovereignSynthesizer {
    private source: GameCacheLoader;

    constructor() {
        this.source = new GameCacheLoader(CACHE_DIR);
    }

    /** Generate RS Wiki URL for a named entity */
    private wikiUrl(name: string): string {
        if (!name || name === "null" || name === "Hidden") return "";
        return `https://runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, "_"))}`;
    }

    async synthesizeRegion(rx: number, ry: number) {
        const regionId = (rx << 8) | ry;
        console.log(`\n🧬⚡ Synthesizing Region [${rx}, ${ry}] (ID: ${regionId})...`);

        const groundedEntities: GroundedEntity[] = [];
        const collisionMatrix: Record<string, number> = {};

        // ── PASS 1: Mapsquare Terrain & Objects (Major 5) ──
        const mapIndex = await this.source.getCacheIndex(cacheMajors.mapsquares);
        const archId = regionId; // (rx << 8) | ry
        const archInfo = mapIndex[archId];

        if (!archInfo) {
            console.warn(`  [SKIP] Mapsquare Archive ${archId} not found in Cache Major 5.`);
            return;
        }

        let terrainEntry: any = null;
        let locEntry: any = null;

        // In RS3 mapsquares, the archive contains multiple files. Usually 0 = locs, 3 = terrain, etc.
        // We will pull the whole archive to identify them.
        const arch = await this.source.getFileArchive(archInfo);
        for (const f of arch) {
            try {
                // Peek at the magic header
                if (f.buffer.byteLength > 4) {
                    const magic = f.buffer.readUInt32BE(0);
                    // "jagx" wait, NXT mapsquares start with "jagx" 0x6A616778. But we use the opdecoder
                    // Let's just try parsing terrain. If it throws, try loc.
                    try {
                        parse.mapsquareTilesNxt.read(f.buffer, this.source);
                        terrainEntry = f;
                        continue;
                    } catch (e) {
                        try {
                            parse.mapsquareTiles.read(f.buffer, this.source);
                            terrainEntry = f;
                            continue;
                        } catch (e2) {}
                    }
                    try {
                        parse.mapsquareLocations.read(f.buffer, this.source);
                        locEntry = f;
                    } catch (e3) {}
                }
            } catch (e) {}
        }

        if (terrainEntry) {
            try {
                const data = terrainEntry.buffer;
                let tilesData: any;
                let isNxt = false;

                // Attempt NXT parsing first for modern RS3 caches
                try {
                    tilesData = parse.mapsquareTilesNxt.read(data, this.source);
                    isNxt = true;
                } catch (nxtErr) {
                    // Fallback to legacy 16384 grid
                    tilesData = parse.mapsquareTiles.read(data, this.source);
                }
                
                // Track raw tile collision per coordinate to merge Z-planes
                const mergedCollision: Record<string, number> = {};

                if (isNxt) {
                    const levels = [tilesData.level0, tilesData.level1, tilesData.level2, tilesData.level3];
                    for (let plane = 0; plane < 4; plane++) {
                        const levelTiles = levels[plane];
                        if (!levelTiles) continue;
                        let tileIndex = 0;
                        for (let x = 0; x < 66; x++) {
                            for (let y = 0; y < 66; y++) {
                                const tile = levelTiles[tileIndex++];
                                if (tile) {
                                    const collisionFlag = tile.flags ?? 0;
                                    // Map coordinates (NXT 66x66 is 1 tile border overlap, shift -1)
                                    const worldX = (rx * 64) + (x - 1);
                                    const worldY = (ry * 64) + (y - 1);
                                    
                                    // Skip over-border bounding tiles
                                    if (x === 0 || x === 65 || y === 0 || y === 65) continue;

                                    const key = `${worldX}_${worldY}`;
                                    mergedCollision[key] = (mergedCollision[key] || 0) | collisionFlag;
                                }
                            }
                        }
                    }
                } else {
                    let tileIndex = 0;
                    for (let plane = 0; plane < 4; plane++) {
                        for (let x = 0; x < 64; x++) {
                            for (let y = 0; y < 64; y++) {
                                const tile = tilesData.tiles[tileIndex++];
                                if (tile) {
                                    const collisionFlag = tile.settings ?? 0;
                                    const worldX = (rx * 64) + x;
                                    const worldY = (ry * 64) + y;
                                    const key = `${worldX}_${worldY}`;
                                    mergedCollision[key] = (mergedCollision[key] || 0) | collisionFlag;
                                }
                            }
                        }
                    }
                }

                // Universal Authority Resolver (Phase 41)
                for (const key in mergedCollision) {
                    const flags = mergedCollision[key];
                    let surfaceType = "terrain";
                    let walkable = true;

                    if (flags & 0x2) {
                        surfaceType = "bridge";
                        walkable = true;
                    } else if (flags & 0x80) {
                        surfaceType = "water";
                        walkable = false;
                    } else {
                        surfaceType = "terrain";
                        const blocked = !!(flags & 0x1);
                        walkable = !blocked;
                    }

                    // Define separated Edge blocking bounds (Phase B3)
                    const edges = {
                        northBlocked: false,
                        southBlocked: false,
                        eastBlocked: false,
                        westBlocked: false
                    };

                    collisionMatrix[key] = { surfaceType, walkable, sourceFlags: flags, edges } as any; 
                }
            } catch (e) { console.error(`  [ERR] Terrain parse failed: ${e}`); }
        }

        if (locEntry) {
            try {
                const data = locEntry.buffer;
                const locs = parse.mapsquareLocations.read(data, this.source);
                for (const loc of locs.locations) {
                    for (const use of loc.uses) {
                        groundedEntities.push({
                            type: "object",
                            id: loc.id,
                            name: "", // Resolved in Pass 2
                            x: (rx * 64) + use.x,
                            y: (ry * 64) + use.y,
                            plane: use.plane,
                            rotation: use.rotation,
                            locType: use.type,
                        });
                    }
                }
            } catch (e) { console.error(`  [ERR] Locations parse failed: ${e}`); }
        }

        // ── PASS 2: Object Data Resolution (Major 16) ──
        const uniqueObjectIds = [...new Set(groundedEntities.filter(e => e.type === "object").map(e => e.id))];
        for (const oid of uniqueObjectIds) {
            try {
                const file = await this.source.getFileById(cacheMajors.objects, oid);
                if (file) {
                    const obj = parse.object.read(file, this.source) as any;
                    const info = {
                        name: obj.name || "",
                        actions: obj.options ? obj.options.filter((o: string) => o && !o.startsWith("null")) : [],
                        solid: !(obj.probably_nocollision === true),
                        width: obj.width ?? 1,
                        length: obj.length ?? 1
                    };

                    for (const entity of groundedEntities) {
                        if (entity.type === "object" && entity.id === oid) {
                            entity.name = info.name;
                            entity.actions = info.actions;
                            entity.wikiUrl = this.wikiUrl(info.name);

                            // Resolve tile footprint & Edge Collision Mask
                            if (entity.locType !== undefined && entity.locType !== 22) {
                                const locType = entity.locType;
                                const rot = entity.rotation ?? 0;
                                const ex = entity.x;
                                const ey = entity.y;

                                const ensureTile = (x: number, y: number) => {
                                    const k = `${x}_${y}`;
                                    if (!collisionMatrix[k]) {
                                        collisionMatrix[k] = { surfaceType: "terrain", walkable: true, sourceFlags: 0, edges: { northBlocked: false, southBlocked: false, eastBlocked: false, westBlocked: false } } as any;
                                    } else if (!(collisionMatrix[k] as any).edges) {
                                        (collisionMatrix[k] as any).edges = { northBlocked: false, southBlocked: false, eastBlocked: false, westBlocked: false };
                                    }
                                    return collisionMatrix[k] as any;
                                };

                                // EDGE COLLISION (Walls, Doors, Fences)
                                if (locType >= 0 && locType <= 3) {
                                    if (info.solid) {
                                        const curr = ensureTile(ex, ey);
                                        const north = ensureTile(ex, ey + 1);
                                        const south = ensureTile(ex, ey - 1);
                                        const east = ensureTile(ex + 1, ey);
                                        const west = ensureTile(ex - 1, ey);

                                        // Wall locTypes primarily block the corresponding edge
                                        // rot 0: West, rot 1: North, rot 2: East, rot 3: South
                                        if (rot === 0) { curr.edges.westBlocked = true; west.edges.eastBlocked = true; }
                                        if (rot === 1) { curr.edges.northBlocked = true; north.edges.southBlocked = true; }
                                        if (rot === 2) { curr.edges.eastBlocked = true; east.edges.westBlocked = true; }
                                        if (rot === 3) { curr.edges.southBlocked = true; south.edges.northBlocked = true; }

                                        // L-shape Corners (locType 2) block an additional adjacent edge
                                        if (locType === 2) {
                                            if (rot === 0) { curr.edges.northBlocked = true; north.edges.southBlocked = true; }
                                            if (rot === 1) { curr.edges.eastBlocked = true; east.edges.westBlocked = true; }
                                            if (rot === 2) { curr.edges.southBlocked = true; south.edges.northBlocked = true; }
                                            if (rot === 3) { curr.edges.westBlocked = true; west.edges.eastBlocked = true; }
                                        }
                                    }
                                } 
                                // TILE OCCUPANCY (Solid Objects)
                                else if (info.solid) {
                                    let sizeX = info.width, sizeY = info.length;
                                    if (rot === 1 || rot === 3) { sizeX = info.length; sizeY = info.width; }
                                    for (let sx = 0; sx < sizeX; sx++) {
                                        for (let sy = 0; sy < sizeY; sy++) {
                                            const tile = ensureTile(ex + sx, ey + sy);
                                            tile.walkable = false;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) { /* skip */ }
        }

        // ── PASS 3: NPC DBRow Spawns ──
        const dbArchIndex = (await this.source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
        const dbArch = await this.source.getFileArchive(dbArchIndex);
        const MIN_X = rx * 64, MAX_X = (rx + 1) * 64 - 1;
        const MIN_Y = ry * 64, MAX_Y = (ry + 1) * 64 - 1;

        for (const file of dbArch) {
            try {
                const row = parse.dbrows.read(file.buffer, this.source) as any;
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

                if (coord !== null) {
                    const x = (coord >> 14) & 0x3FFF, y = coord & 0x3FFF, plane = (coord >> 28);
                    if (x >= MIN_X && x <= MAX_X && y >= MIN_Y && y <= MAX_Y) {
                        groundedEntities.push({
                            type: "npc",
                            id: npcId,
                            name: name || `NPC_${npcId}`,
                            x, y, plane,
                            wikiUrl: this.wikiUrl(name || "")
                        });
                    }
                }
            } catch (e) { /* skip */ }
        }

        // ── PASS 4: EDGE MIRROR INVARIANT AUDIT ──
        let mirrorViolations = 0;
        for (const key of Object.keys(collisionMatrix)) {
            const tile = collisionMatrix[key] as any;
            if (!tile?.edges) continue;
            const [xStr, yStr] = key.split('_');
            const x = parseInt(xStr), y = parseInt(yStr);
            
            const pairs: Array<{ dir: string; dx: number; dy: number; mirror: string }> = [
                { dir: 'northBlocked', dx: 0, dy: 1, mirror: 'southBlocked' },
                { dir: 'southBlocked', dx: 0, dy: -1, mirror: 'northBlocked' },
                { dir: 'eastBlocked',  dx: 1, dy: 0, mirror: 'westBlocked' },
                { dir: 'westBlocked',  dx: -1, dy: 0, mirror: 'eastBlocked' },
            ];

            for (const { dir, dx, dy, mirror } of pairs) {
                if (!tile.edges[dir]) continue;
                const adjKey = `${x + dx}_${y + dy}`;
                const adj = collisionMatrix[adjKey] as any;
                if (adj?.edges && !adj.edges[mirror]) {
                    mirrorViolations++;
                    adj.edges[mirror] = true; // Auto-heal
                }
            }
        }
        if (mirrorViolations > 0) {
            console.log(`  ⚠️  EDGE MIRROR AUDIT: ${mirrorViolations} violations auto-healed.`);
        } else {
            console.log(`  ✅ EDGE MIRROR AUDIT: All edges reciprocal.`);
        }

        // ── PASS 5: Synthesis & Output ──
        const output = {
            regionId,
            rx, ry,
            metadata: {
                total_entities: groundedEntities.length,
                total_npcs: groundedEntities.filter(e => e.type === "npc").length,
                total_objects: groundedEntities.filter(e => e.type === "object").length,
                synthesized_at: new Date().toISOString(),
                edge_mirror_violations_healed: mirrorViolations
            },
            entities: groundedEntities.filter(e => e.name && e.name !== "null" && e.name !== "Hidden"),
            collision_matrix: collisionMatrix
        };

        const outPath = path.join(OUTPUT_DIR, `ms_${rx}_${ry}.json`);
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

        console.log(`  ✅ Region ${regionId} synthesized. Entities: ${output.metadata.total_entities}`);
    }

    async close() {
        this.source.close();
    }
}

// CLI Execution Entry
if (process.argv[2] === "--run") {
    const rx = parseInt(process.argv[3]);
    const ry = parseInt(process.argv[4]);
    if (!isNaN(rx) && !isNaN(ry)) {
        const synth = new UniversalSovereignSynthesizer();
        synth.synthesizeRegion(rx, ry).then(() => synth.close());
    }
}
