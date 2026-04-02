import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChunkBounds {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  plane: number;
}

export interface CollisionEntry {
  x: number; z: number;
  bitmask: number;
  walkable: boolean;
}

export interface ChunkMeshManifest {
  chunkKey: string;           // "havenhythe_synthesis"
  groupFiles: string[];       // Absolute paths to *_synthesis.json to load
  principleFiles: string[];   // Absolute paths to GROUP_PRINCIPLE_*.json (if present)
  entityIds: number[];        // NPCs + objects to materialize
  entities: SynthesisEntity[];
  collisionMatrix: CollisionEntry[];
  bounds: ChunkBounds;
  zoneName: string | null;    // From mapzones_registry or the synthesis file
}

export interface MapZoneEntry {
  id: number;
  name: string; // The UI display name
  internal_name?: string; // e.g. "havenhythe"
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; plane: number }[]; // In the mapzones_registry this is an array of bounds usually!
  npcs?: number[];
  objects?: number[];
}

export interface SynthesisEntity {
  id: number;
  type: 'npc' | 'object' | 'loc';
  x: number;
  y?: number;
  z?: number;
  plane?: number;
  modelIds?: number[];
  name?: string;
  rotation?: number;
  thickModelData?: any;
}

export interface SynthesisFile {
  name?: string;
  city?: string; // havenhythe_synthesis uses "city" instead of "name"
  bounds?: ChunkBounds;
  entities?: SynthesisEntity[];
  npcs?: SynthesisEntity[];
  objects?: SynthesisEntity[];
  locs?: SynthesisEntity[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PEDAGOGY_ROOT = 'D:\\sovereign\\memory\\pedagogy';
const CHUNK_SIZE = 104; // RS mapsquare is 64 tiles; group chunks are 104x104

// ── SovereignGroundingStream ──────────────────────────────────────────────────

export class SovereignGroundingStream {
  private pedagogy: string;
  private synthesisIndex: Map<string, SynthesisFile> = new Map(); // filename → parsed
  private mapzones: MapZoneEntry[] = [];
  private synthesisFiles: string[] = [];
  private initialized = false;

  constructor(pedagogyRoot: string = PEDAGOGY_ROOT) {
    this.pedagogy = pedagogyRoot;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load mapzones for zone → synthesis file resolution
    const mapzonesPath = path.join(this.pedagogy, 'mapzones_registry.json');
    if (fs.existsSync(mapzonesPath)) {
      const raw = JSON.parse(fs.readFileSync(mapzonesPath, 'utf-8'));
      this.mapzones = Array.isArray(raw) ? raw : Object.values(raw);
    }

    // Index synthesis files — load headers only, defer full parse until needed
    const files = fs.readdirSync(this.pedagogy);
    this.synthesisFiles = files
      .filter(f => f.endsWith('_synthesis.json'))
      .map(f => path.join(this.pedagogy, f));

    console.log(
      `[SovereignGroundingStream] Found ${this.synthesisFiles.length} synthesis files`
    );
    this.initialized = true;
  }

  // ── Primary API ────────────────────────────────────────────────────────────

  getStreamingManifests(
    avatarTileX: number,
    avatarTileZ: number,
    radiusInTiles = 208, // 2 mapsquares = 128 tiles; 208 gives comfortable buffer
    plane = 0
  ): ChunkMeshManifest[] {

    // Determine which synthesis files are spatially relevant
    const relevant = this.resolveRelevantSynthesisFiles(avatarTileX, avatarTileZ);
    const manifests: ChunkMeshManifest[] = [];

    for (const filePath of relevant) {
      const synthesis = this.loadSynthesis(filePath);
      const allEntities = [
        ...(synthesis.entities ?? []),
        ...(synthesis.npcs     ?? []),
        ...(synthesis.objects  ?? []),
        ...(synthesis.locs     ?? []),
      ];

      // Spatial filter — only entities within streaming radius
      // Note: synthesis files currently map Z axis over the "y" property.
      const inRange = allEntities.filter(e => {
        const ePlane = e.plane ?? 0;
        const eZ = e.z ?? e.y ?? 0;
        return ePlane === plane &&
          Math.abs(e.x - avatarTileX) <= radiusInTiles &&
          Math.abs(eZ - avatarTileZ) <= radiusInTiles;
      });

      if (inRange.length === 0) continue;

      manifests.push({
        chunkKey: path.basename(filePath, '.json'),
        groupFiles: [filePath],
        principleFiles: [],
        entityIds: inRange.map(e => e.id),
        entities: inRange,             // full structs, not just IDs
        collisionMatrix: [],           // populated separately from SpatialSovereigntyLimb
        bounds: this.deriveBounds(inRange, plane),
        zoneName: synthesis.city ?? synthesis.name ?? null,
      });
    }

    return manifests;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveRelevantSynthesisFiles(x: number, z: number): string[] {
    // Primary: match by zone bounds from mapzones_registry
    // mapzones_registry actual format has `bounds` as an array of boxes
    const matchedZones = this.mapzones.filter(zone => {
      if (!zone.bounds) return false;
      const boundsArray = Array.isArray(zone.bounds) ? zone.bounds : [zone.bounds];
      return boundsArray.some((b: any) => {
        // b.src usually has xstart, xend, zstart, zend
        const minX = b.src?.xstart ?? b.minX;
        const maxX = b.src?.xend ?? b.maxX;
        const minZ = b.src?.zstart ?? b.minZ;
        const maxZ = b.src?.zend ?? b.maxZ;
        return x >= minX - 208 && x <= maxX + 208 &&
               z >= minZ - 208 && z <= maxZ + 208;
      });
    });

    const matched = matchedZones
      .map(zone => {
        const synthName = (zone.internal_name || zone.name)?.toLowerCase().replace(/\s+/g, '') + '_synthesis.json';
        return this.synthesisFiles.find(f => f.toLowerCase().endsWith(synthName));
      })
      .filter(Boolean) as string[];

    // Fallback: if no zone match, load all synthesis files (small set, acceptable)
    const result = matched.length > 0 ? matched : this.synthesisFiles;

    // POG2 Sandbox Hub: Explicit Injection (Coordinate Range: 10000 - 10100)
    if (x >= 9900 && x <= 10100 && z >= 9900 && z <= 10100) {
      const sandboxPath = this.synthesisFiles.find(f => f.endsWith('sandbox_synthesis.json'));
      if (sandboxPath && !result.includes(sandboxPath)) {
        result.push(sandboxPath);
      }
    }

    return result;
  }

  private loadSynthesis(filePath: string): SynthesisFile {
    if (!this.synthesisIndex.has(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.synthesisIndex.set(filePath, raw);
      } catch (err) {
        console.warn(`[SovereignGroundingStream] Failed to load ${filePath}: `, err);
      }
    }
    return this.synthesisIndex.get(filePath)!;
  }

  private deriveBounds(entities: SynthesisEntity[], plane: number): ChunkBounds {
    const xs = entities.map(e => e.x);
    const zs = entities.map(e => e.z ?? e.y ?? 0);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minZ: Math.min(...zs), maxZ: Math.max(...zs),
      plane,
    };
  }

  /** Returns the full list of indexed chunk keys (useful for debug overlays) */
  getIndexedChunkKeys(): string[] {
    return this.synthesisFiles.map(f => path.basename(f, '.json'));
  }
}
