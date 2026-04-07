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

export class SovereignWorldLoader {
    private static instance: SovereignWorldLoader;

    static getInstance() {
        if (!this.instance) this.instance = new SovereignWorldLoader();
        return this.instance;
    }

    /**
     * Loads 1:1 world truth for a specific region.
     * Prioritizes 'unified_extract' (High Fidelity) over 'world_extract'.
     */
    async loadRegionTruth(rx: number, ry: number) {
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
                    return this.normalizeData(data);
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
    private normalizeData(data: any) {
        const entities: SovereignEntity[] = [];

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

        return {
            regionId: data.regionId || (data.chunkX << 8 | data.chunkZ),
            entities,
            collisionMatrix: data.collision_matrix || this.buildMatrixFromFlags(data.tileFlags)
        };
    }

    private buildMatrixFromFlags(flags: any[]) {
        if (!flags) return {};
        const matrix: Record<string, number> = {};
        flags.forEach(f => {
            const key = `${f.plane}_${f.x}_${f.z}`;
            matrix[key] = f.collision;
        });
        return matrix;
    }
}
