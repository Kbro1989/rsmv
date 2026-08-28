import { SovereignBridge } from "./SovereignBridge";
import * as fs from "fs";
import * as path from "path";

/**
 * SovereignWorldLoader.ts
 * 
 * Bridges the "Gold Mine" (unified_extract/world_extract JSONs) 
 * into the interactive 3D Sovereign Engine.
 */

const UNIFIED_DIR = "D:\\sovereign\\atlas\\spatial\\unified_extract";
const WORLD_EXTRACT_DIR = "D:\\sovereign\\atlas\\spatial\\world_extract";

export interface SovereignEntity {
    id: number;
    type: 'npc' | 'object';
    name: string;
    x: number;
    y: number;
    plane: number;
    rotation?: number;
    wikiUrl?: string;
}

export interface CollisionTile {
    walkable: boolean;
    surfaceType: string;
    sourceFlags: number;
    edges: {
        northBlocked?: boolean;
        southBlocked?: boolean;
        eastBlocked?: boolean;
        westBlocked?: boolean;
    };
}

export interface RegionTruth {
    regionId: number;
    entities: SovereignEntity[];
    collisionMatrix: Record<string, CollisionTile>;
}

export class SovereignWorldLoader {
    private static instance: SovereignWorldLoader;
    private cache: Map<string, RegionTruth> = new Map();

    static getInstance() {
        if (!this.instance) this.instance = new SovereignWorldLoader();
        return this.instance;
    }

    /**
     * Loads 1:1 world truth for a specific region.
     * Prioritizes 'unified_extract' (High Fidelity) over 'world_extract'.
     */
    async loadRegionTruth(rx: number, ry: number): Promise<RegionTruth | null> {
        const cacheKey = `${rx}_${ry}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

        const fileName = `ms_${rx}_${ry}.json`;
        const paths = [
            path.join(UNIFIED_DIR, fileName),
            path.join(WORLD_EXTRACT_DIR, fileName)
        ];

        for (const p of paths) {
            if (fs.existsSync(p)) {
                try {
                    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                    console.log(`🧬⚡ Hydro-Synthesized Region [${rx}, ${ry}] from ${p}`);
                    const truth = this.normalizeData(data);
                    this.cache.set(cacheKey, truth);
                    return truth;
                } catch (e) {
                    console.error(`  [ERR] Failed to parse world truth at ${p}:`, e);
                }
            }
        }

        console.warn(`  [WARN] No pre-synthesized truth found for region [${rx}, ${ry}]`);
        return null;
    }

    /**
     * Normalizes different JSON formats into a standard Sovereign structure.
     */
    private normalizeData(data: any): RegionTruth {
        const entities: SovereignEntity[] = [];
        const collisionMatrix: Record<string, CollisionTile> = {};

        // Handle 'unified_extract' format (objects, tileFlags)
        if (data.objects) {
            data.objects.forEach((obj: any) => {
                entities.push({
                    id: obj.id,
                    type: 'object',
                    name: obj.name || `Object_${obj.id}`,
                    x: obj.worldX || obj.x,
                    y: obj.worldZ || obj.z,
                    plane: obj.plane,
                    rotation: obj.rotation,
                    wikiUrl: obj.wikiUrl
                });
            });
        }

        // Handle 'world_extract' format (entities array)
        if (data.entities) {
            data.entities.forEach((ent: any) => {
                entities.push({
                    id: ent.id,
                    type: ent.type,
                    name: ent.name,
                    x: ent.x,
                    y: ent.y,
                    plane: ent.plane,
                    rotation: ent.rotation,
                    wikiUrl: ent.wikiUrl
                });
            });
        }

        // Phase B3 collision_matrix (semantic edges + surface types)
        if (data.collision_matrix) {
            for (const [key, tile] of Object.entries(data.collision_matrix)) {
                const t = tile as any;
                collisionMatrix[key] = {
                    walkable: t.walkable ?? true,
                    surfaceType: t.surfaceType ?? 'terrain',
                    sourceFlags: t.sourceFlags ?? 0,
                    edges: {
                        northBlocked: t.edges?.northBlocked ?? false,
                        southBlocked: t.edges?.southBlocked ?? false,
                        eastBlocked: t.edges?.eastBlocked ?? false,
                        westBlocked: t.edges?.westBlocked ?? false,
                    }
                };
            }
        } else if (data.tileFlags) {
            // Legacy fallback: convert flat tileFlags to collision tiles
            this.buildMatrixFromFlags(data.tileFlags, collisionMatrix);
        }

        return {
            regionId: data.regionId || (data.chunkX << 8 | data.chunkZ),
            entities,
            collisionMatrix
        };
    }

    private buildMatrixFromFlags(flags: any[], out: Record<string, CollisionTile>) {
        if (!flags) return;
        flags.forEach(f => {
            const key = `${f.x}_${f.z}`;
            out[key] = {
                walkable: f.collision === 0,
                surfaceType: 'terrain',
                sourceFlags: f.collision || 0,
                edges: {}
            };
        });
    }
}

