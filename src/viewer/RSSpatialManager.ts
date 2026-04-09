import * as THREE from 'three';
import { SovereignGroundingStream } from './SovereignGroundingStream';
import { RSMeshLoader } from './RSMeshLoader';
import { ThreejsSceneCache } from '../3d/modeltothree';
import { SovereignWorldLoader, CollisionTile } from './SovereignWorldLoader';

export class RSSpatialManager {
  private grounding = new SovereignGroundingStream();
  public loader: RSMeshLoader;
  private loadedChunks = new Set<string>();
  private collisionCache = new Map<string, CollisionTile>();
  private loadedCollisionRegions = new Set<string>();

  constructor(sceneCache: ThreejsSceneCache) {
    this.loader = new RSMeshLoader(sceneCache);
  }

  async initialize(): Promise<void> {
    await this.grounding.initialize();
    console.log('[RSSpatialManager] Grounding stream initialized');
  }

  public setCacheLoader(loader: any) {
    this.grounding.setCacheSubstrate(loader);
  }

  // Called from RSEngine tick — cheap after first pass (loadedChunks guards re-entry)
  async stream(avatarTileX: number, avatarTileZ: number, scene: THREE.Object3D, plane: number = 0): Promise<void> {
    // Hydrate collision cache for this region
    const rx = Math.floor(avatarTileX / 64);
    const rz = Math.floor(avatarTileZ / 64);
    const regionKey = `${rx}_${rz}`;
    if (!this.loadedCollisionRegions.has(regionKey)) {
      this.loadedCollisionRegions.add(regionKey);
      const truth = await SovereignWorldLoader.getInstance().loadRegionTruth(rx, rz);
      if (truth) {
        for (const [key, tile] of Object.entries(truth.collisionMatrix)) {
          this.collisionCache.set(key, tile);
        }
        console.log(`[RSSpatialManager] Collision cache hydrated for region [${rx}, ${rz}]: ${Object.keys(truth.collisionMatrix).length} tiles`);
      }
    }

    const manifests = this.grounding.getStreamingManifests(avatarTileX, avatarTileZ, 208, plane);

    for (const manifest of manifests) {
      if (this.loadedChunks.has(manifest.chunkKey)) continue;
      this.loadedChunks.add(manifest.chunkKey);

      console.log(
        `[Spatial] Streaming ${manifest.chunkKey} ` +
        `(${manifest.zoneName ?? 'unnamed'}) — ` +
        `${manifest.entityIds.length} entities`
      );

      // Non-blocking — don't await in the tick loop
      this.loader.loadManifest(manifest, scene).catch(err =>
        console.error(`[Spatial] loadManifest failed for ${manifest.chunkKey}:`, err)
      );
    }
  }

  /**
   * Sovereign Collision Engine: Real walkability check from collision_matrix.
   */
  public isWalkable(tileX: number, tileZ: number): boolean {
    const floorX = Math.floor(tileX);
    const floorZ = Math.floor(tileZ);
    const key = `${floorX}_${floorZ}`;
    const tile = this.collisionCache.get(key);
    if (!tile) return true; // Unknown tiles default to passable (unmapped void)
    return tile.walkable;
  }

  /**
   * Returns the full collision cache for overlay rendering.
   */
  public getCollisionMatrix(): Map<string, CollisionTile> {
    return this.collisionCache;
  }

  /** Returns the full list of indexed chunk keys (useful for debug overlays) */
  getIndexedChunkKeys(): string[] {
    return Array.from(this.loadedChunks);
  }
}

