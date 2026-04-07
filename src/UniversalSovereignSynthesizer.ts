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
        const terrainEntry = await this.source.findFileByName(cacheMajors.mapsquares, `m${rx}_${ry}`);
        const locEntry = await this.source.findFileByName(cacheMajors.mapsquares, `l${rx}_${ry}`);

        if (!terrainEntry && !locEntry) {
            console.warn(`  [SKIP] No named map files found for [${rx}, ${ry}] (m${rx}_${ry} / l${rx}_${ry})`);
            return;
        }

        if (terrainEntry) {
            try {
                const data = await this.source.getFile(terrainEntry.major, terrainEntry.minor, terrainEntry.crc);
                const tilesData = parse.mapsquareTiles.read(data, this.source);
                let tileIndex = 0;
                for (let plane = 0; plane < 4; plane++) {
                    for (let x = 0; x < 64; x++) {
                        for (let y = 0; y < 64; y++) {
                            const tile = tilesData.tiles[tileIndex++];
                            if (tile && tile.settings && (tile.settings & 1) !== 0) {
                                const worldX = (rx * 64) + x;
                                const worldY = (ry * 64) + y;
                                const key = `${plane}_${worldX}_${worldY}`;
                                collisionMatrix[key] = (collisionMatrix[key] || 0) | 0x200000;
                            }
                        }
                    }
                }
            } catch (e) { console.error(`  [ERR] Terrain parse failed: ${e}`); }
        }

        if (locEntry) {
            try {
                const data = await this.source.getFile(locEntry.major, locEntry.minor, locEntry.crc);
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

                            // Add to collision matrix if solid
                            if (info.solid && entity.locType !== undefined && entity.locType !== 22) {
                                let sizeX = info.width, sizeY = info.length;
                                if (entity.rotation === 1 || entity.rotation === 3) { sizeX = info.length; sizeY = info.width; }
                                for (let sx = 0; sx < sizeX; sx++) {
                                    for (let sy = 0; sy < sizeY; sy++) {
                                        const key = `${entity.plane}_${entity.x + sx}_${entity.y + sy}`;
                                        collisionMatrix[key] = (collisionMatrix[key] || 0) | 0x100;
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

        // ── PASS 4: Synthesis & Output ──
        const output = {
            regionId,
            rx, ry,
            metadata: {
                total_entities: groundedEntities.length,
                total_npcs: groundedEntities.filter(e => e.type === "npc").length,
                total_objects: groundedEntities.filter(e => e.type === "object").length,
                synthesized_at: new Date().toISOString()
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
