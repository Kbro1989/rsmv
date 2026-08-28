import * as THREE from 'three';
import { ThreejsSceneCache } from '../3d/modeltothree';
import { locToModel, RSModel } from '../3d/modelnodes';
import { SovereignBridge } from './SovereignBridge';

/**
 * SovereignObjectRenderer.ts
 * 
 * Real-world manifestation of RS Objects (Locs).
 * NO MOCKS. NO PLACEHOLDERS.
 */

export class SovereignObjectRenderer {
    private cache: ThreejsSceneCache;
    private scene: THREE.Object3D;
    private renderedObjects = new Map<string, THREE.Object3D>();

    constructor(cache: ThreejsSceneCache, scene: THREE.Object3D) {
        this.cache = cache;
        this.scene = scene;
    }

    /**
     * Manifests a 1:1 physical object in the 3D scene.
     */
    async spawnObject(id: number, pos: { x: number, y: number, z: number }, rotation: number = 0) {
        const key = `loc_${id}_${pos.x}_${pos.z}`;
        if (this.renderedObjects.has(key)) return;

        try {
            const locInfo = await locToModel(this.cache, id);
            if (!locInfo) return;

            const rsModel = new RSModel(this.cache, locInfo.models, `LOC_${id}`, { noSkin: true });
            const loaded = await rsModel.model;

            // Apply Jagex Transformation Matrix
            // tile_x * 512 is the base, but we must account for model-internal offsets
            loaded.mesh.position.set(pos.x * 512, pos.y * 512, pos.z * 512);
            
            // Jagex rotation is 0-3 (90-degree steps)
            // 0=South, 1=West, 2=North, 3=East
            loaded.mesh.rotation.y = (rotation * Math.PI) / 2;

            this.scene.add(loaded.mesh);
            this.renderedObjects.set(key, loaded.mesh);
            
            // Log manifestation for audit
            // SovereignBridge.getInstance().log('INFO', 'Renderer', `Manifested Loc ${id} at ${pos.x}, ${pos.z}`);
        } catch (e) {
            console.error(`  [ERR] Failed to manifest object ${id}:`, e);
        }
    }

    /**
     * Batch manifestation for a mapsquare.
     */
    async batchSpawn(objects: any[]) {
        const tasks = objects.map(obj => this.spawnObject(
            obj.id || obj.objectId, 
            { x: obj.worldX || obj.x, y: obj.worldY || 0, z: obj.worldZ || obj.z || obj.y },
            obj.rotation || 0
        ));
        await Promise.all(tasks);
    }
}
