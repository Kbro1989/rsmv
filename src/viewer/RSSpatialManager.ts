import * as THREE from 'three';
import { SovereignGroundingStream } from './SovereignGroundingStream';
import { RSMeshLoader } from './RSMeshLoader';
import { ThreejsSceneCache } from '../3d/modeltothree';

export class RSSpatialManager {
  private grounding = new SovereignGroundingStream();
  public loader: RSMeshLoader;
  private loadedChunks = new Set<string>();

  constructor(sceneCache: ThreejsSceneCache) {
    this.loader = new RSMeshLoader(sceneCache);
  }

  async initialize(): Promise<void> {
    await this.grounding.initialize();
    console.log('[RSSpatialManager] Grounding stream initialized');
  }

  // Called from RSEngine tick — cheap after first pass (loadedChunks guards re-entry)
  async stream(avatarTileX: number, avatarTileZ: number, scene: THREE.Scene): Promise<void> {
    const manifests = this.grounding.getStreamingManifests(avatarTileX, avatarTileZ, 208);

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
   * Sovereign Collision Engine: Respects T/O/X Zoned Navigation.
   * "Yesterday's Truth" for the 600ms World Pulse.
   */
  public isWalkable(tileX: number, tileZ: number): boolean {
    const floorX = Math.floor(tileX);
    const floorZ = Math.floor(tileZ);

    // Placeholder: Check the grounded manifests for T/O/X zoning logic
    // Currently, if tile matched a synthesis entity's center exactly, it might be an O (Obstacle)
    // T (Target) = Actionable | O (Obstacle) = Blocked | X (Boundary) = Total Block
    
    // Defaulting to true for the baseline until the T/O/X grid is formally loaded from the pedagogy JSONs
    return true; 
  }
}
