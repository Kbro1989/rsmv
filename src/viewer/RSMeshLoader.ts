import * as THREE from 'three';
import { RSModel, npcToModel, locToModel } from '../3d/modelnodes';
import { ThreejsSceneCache } from '../3d/modeltothree';
import { ChunkMeshManifest, SynthesisEntity } from './SovereignGroundingStream';
import { SovereignThickSubstrateParser } from './SovereignThickSubstrateParser';
import { parseThickModelData } from '../3d/rt7model';
import { SimpleModelDef } from '../3d/modelnodes';

interface SpawnedEntity {
  entityId: number;
  type: string;
  rootNode: THREE.Group;
  rsModel: RSModel | null;
}

export class RSMeshLoader {
  private sceneCache: ThreejsSceneCache;
  private spawnedEntities: Map<string, SpawnedEntity> = new Map(); // key: `${type}_${id}_${x}_${z}`

  constructor(sceneCache: ThreejsSceneCache) {
    this.sceneCache = sceneCache;
  }

  async loadManifest(manifest: ChunkMeshManifest, scene: THREE.Object3D): Promise<void> {
    console.log(`[RSMeshLoader] Materializing ${manifest.entities.length} entities for ${manifest.zoneName}`);

    const promises = manifest.entities.map(e => this.spawnEntity(e, scene));
    const results = await Promise.allSettled(promises);

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`[RSMeshLoader] ${failed}/${manifest.entities.length} entities failed to load`);
    }
  }

  private async spawnEntity(entity: SynthesisEntity, scene: THREE.Object3D): Promise<void> {
    const eZ = entity.z ?? entity.y ?? 0;
    const ePlane = entity.plane ?? 0;
    const key = `${entity.type}_${entity.id}_${entity.x}_${eZ}_${ePlane}`;
    if (this.spawnedEntities.has(key)) return; // already spawned

    const rootNode = new THREE.Group();
    // modelnode scale is (1/512, 1/512, -1/512)
    // We multiply by 512 so the final world position is [entity.x, height, -eZ]
    const PLANE_HEIGHT = 2048; // Sovereign Plane Separation (4 levels of height)
    rootNode.position.set(entity.x * 512, ePlane * PLANE_HEIGHT, eZ * 512);

    let rsModel: RSModel | null = null;

    try {
      if (entity.thickModelData) {
        // Synthesis entities can provide their own model data directly
        const materialized = SovereignThickSubstrateParser.materializeModelSubstrate(entity.thickModelData);
        const modelData = parseThickModelData(materialized);

        const modelDef: SimpleModelDef = [{
          modelid: -1, 
          mods: {},
          injectedModelData: modelData
        }];

        rsModel = new RSModel(
          this.sceneCache,
          modelDef,
          `SYNTH_${entity.id}`,
          { noSkin: true }
        );
        const loaded = await rsModel.model;
        rootNode.add(loaded.mesh);
      } else if (entity.type === 'npc') {
        const npcInfo = await npcToModel(this.sceneCache, { id: entity.id, head: false });
        if (npcInfo) {
          rsModel = new RSModel(
            this.sceneCache,
            npcInfo.models,
            `NPC_${entity.id}`,
            { noSkin: false }
          );
          const loaded = await rsModel.model;
          rootNode.add(loaded.mesh);

          // Play idle animation if available
          if (npcInfo.anims?.default) {
            rsModel.setAnimation(npcInfo.anims.default);
          }
        }
      } else if (entity.type === 'loc' || entity.type === 'object') {
        // ── Pipeline 2: Object / LOC ─────────────────────────────────────────
        // Use the Object Definition from the cache, NOT raw modelIds.
        // This correctly applies:
        //   - color_replacements  (palette swaps)
        //   - material_replacements
        //   - scale (scaleX/Y/Z from the def, 100 = 1.0x)
        //   - probably_animation (idle / open trigger)
        const locInfo = await locToModel(this.sceneCache, entity.id);
        if (locInfo && locInfo.models.length > 0) {
          rsModel = new RSModel(
            this.sceneCache,
            locInfo.models,         // already has mods (recolors) baked in
            `LOC_${entity.id}`,
            { noSkin: true }
          );
          const loaded = await rsModel.model;

          // Apply RS rotation (0–3, each step = 90° CCW in RS space)
          if (entity.rotation !== undefined) {
            loaded.mesh.rotation.y = (entity.rotation * Math.PI) / 2;
          }

          // Apply scale from Object Definition (100 = 1.0x, 200 = 2.0x)
          const info = locInfo.info as any;
          if (info) {
            const sx = (info.scaleX ?? 100) / 100;
            const sy = (info.scaleY ?? 100) / 100;
            const sz = (info.scaleZ ?? 100) / 100;
            loaded.mesh.scale.set(sx, sy, sz);
          }

          // Play idle/interaction animation if defined
          if (locInfo.anims?.default !== undefined) {
            rsModel.setAnimation(locInfo.anims.default);
          }

          rootNode.add(loaded.mesh);
        }
      }
    } catch (err) {
      console.warn(`[RSMeshLoader] Entity ${entity.type}#${entity.id} failed:`, err);
    }

    scene.add(rootNode);
    this.spawnedEntities.set(key, { entityId: entity.id, type: entity.type, rootNode, rsModel });
  }

  /** Tear down all spawned entities (for chunk unloading) */
  unloadAll(scene: THREE.Object3D): void {
    for (const { rootNode, rsModel } of this.spawnedEntities.values()) {
      scene.remove(rootNode);
      // Cleanup animation mixers etc if possible
      // rsModel doesn't expose cleanup() by default unless customized, ignoring for now.
    }
    this.spawnedEntities.clear();
  }

  get spawnCount(): number {
    return this.spawnedEntities.size;
  }
}
