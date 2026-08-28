import * as fs from 'fs';
import * as path from 'path';
import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors, cacheMapFiles } from '../constants';
import { parse } from '../opdecoder';
import { Archive } from '../cache';

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
const ATLAS_ROOT = 'D:\\sovereign\\atlas\\spatial\\world_extract';
const UNIFIED_ROOT = 'D:\\sovereign\\atlas\\spatial\\unified_extract';
const CHUNK_SIZE = 104; // RS mapsquare is 64 tiles; group chunks are 104x104

// ── SovereignGroundingStream ──────────────────────────────────────────────────

export class SovereignGroundingStream {
  private pedagogy: string;
  private synthesisIndex: Map<string, SynthesisFile> = new Map(); // filename → parsed
  private mapzones: MapZoneEntry[] = [];
  private synthesisFiles: string[] = [];
  private mapsquareFiles: string[] = [];
  private mapsquareIndex = new Map<string, string>(); // "X_Z" -> fullPath
  private initialized = false;
  private cacheSubstrate: GameCacheLoader | null = null;
  private pendingMaterializations = new Set<string>();

  constructor(pedagogyRoot: string = PEDAGOGY_ROOT) {
    this.pedagogy = pedagogyRoot;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  public setCacheSubstrate(substrate: GameCacheLoader) {
    this.cacheSubstrate = substrate;
    console.log(`[SovereignGroundingStream] Neural link to Jagex Cache Substrate established.`);
  }

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

    // Index Atlas world-extract mapsquares
    if (fs.existsSync(ATLAS_ROOT)) {
      const atlasFiles = fs.readdirSync(ATLAS_ROOT);
      this.mapsquareFiles = atlasFiles
        .filter(f => f.startsWith('ms_') && f.endsWith('.json'))
        .map(f => path.join(ATLAS_ROOT, f));
      
      for (const f of this.mapsquareFiles) {
        const parts = path.basename(f, '.json').split('_'); // ["ms", "8", "25"]
        if (parts.length === 3) {
          this.mapsquareIndex.set(`${parts[1]}_${parts[2]}`, f);
        }
      }
      console.log(`[SovereignGroundingStream] Indexed ${this.mapsquareFiles.length} Atlas Mapsquares.`);
    }

    // Index Unified Spatial Truth (High Fidelity)
    if (fs.existsSync(UNIFIED_ROOT)) {
      const unifiedFiles = fs.readdirSync(UNIFIED_ROOT);
      for (const f of unifiedFiles) {
        if (f.startsWith('ms_') && f.endsWith('.json')) {
          const parts = f.split('_');
          this.mapsquareIndex.set(`${parts[1]}_${parts[2].replace('.json', '')}`, path.join(UNIFIED_ROOT, f));
        }
      }
      console.log(`[SovereignGroundingStream] Supreme Ground Truth Index Loaded: ${unifiedFiles.length} files.`);
    }

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

      // Godhead Varbit Extraction: Infiltrate Logic
      this.infiltrateLogic(allEntities);

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
    const results = new Set<string>();

    // Primary: match by zone bounds from mapzones_registry
    const matchedZones = this.mapzones.filter(zone => {
      if (!zone.bounds) return false;
      const boundsArray = Array.isArray(zone.bounds) ? zone.bounds : [zone.bounds];
      return boundsArray.some((b: any) => {
        return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
      });
    });

    matchedZones.forEach(zone => {
      const fileName = `${(zone.internal_name || zone.name).toLowerCase().replace(/\s+/g, '')}_synthesis.json`;
      const fullPath = this.synthesisFiles.find(f => f.toLowerCase().endsWith(fileName));
      if (fullPath) results.add(fullPath);
    });

    // Secondary: Explicit Mapsquare Chunk Matching (64x64 blocks)
    const mx = Math.floor(x / 64);
    const mz = Math.floor(z / 64);
    const msPath = this.mapsquareIndex.get(`${mx}_${mz}`);
    if (msPath) {
      results.add(msPath);
    } else if (this.cacheSubstrate) {
      // Tertiary: Brute-Force Cache Discovery
      const virtualKey = `cache_ms_${mx}_${mz}`;
      results.add(virtualKey);
    }

    // POG2 Sandbox Hub: Explicit Injection (Coordinate Range: 10000 - 10100)
    if (x >= 9900 && x <= 10100 && z >= 9900 && z <= 10100) {
      const sandboxPath = this.synthesisFiles.find(f => f.endsWith('sandbox_synthesis.json'));
      if (sandboxPath) {
        results.add(sandboxPath);
      }
    }

    return Array.from(results);
  }

  private loadSynthesis(filePath: string): SynthesisFile {
    if (this.synthesisIndex.has(filePath)) return this.synthesisIndex.get(filePath)!;

    // Handle virtual cache-backed files
    if (filePath.startsWith('cache_ms_')) {
        const parts = filePath.split('_'); // ["cache", "ms", "8", "25"]
        const mx = parseInt(parts[2]);
        const mz = parseInt(parts[3]);
        return this.materializeFromCache(mx, mz);
    }

    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // Normalize Atlas ms_*.json format (uses 'objects' primarily) to SynthesisFile format
      let normalized: SynthesisFile = {};
      if (path.basename(filePath).startsWith('ms_')) {
        normalized = {
          name: `Mapsquare ${path.basename(filePath, '.json').replace('ms_', '')}`,
          objects: raw.objects?.map((obj: any) => ({
            ...obj,
            id: obj.objectId, // MapSquare 'objectId' -> Synthesis 'id'
            type: 'object'
          })) || []
        };
      } else {
        normalized = raw;
      }

      this.synthesisIndex.set(filePath, normalized);
      return normalized;
    } catch (err) {
      console.warn(`[SovereignGroundingStream] Failed to load ${filePath}: `, err);
      return {};
    }
  }

  private materializeFromCache(mx: number, mz: number): SynthesisFile {
      const virtualKey = `cache_ms_${mx}_${mz}`;
      
      // Ensure we only brute-force the local SQLITE substrate, not the LIVE server.
      // And check the extraction lock.
      if (!this.cacheSubstrate || !(this.cacheSubstrate instanceof GameCacheLoader) || this.pendingMaterializations.has(virtualKey)) {
          return this.synthesisIndex.get(virtualKey) || {};
      }
      
      const archId = (mx << 8) | mz;
      const normalized: SynthesisFile = {
          name: `Cache Brute Force ${mx}_${mz}`,
          objects: []
      };

      this.pendingMaterializations.add(virtualKey);
      
      console.log(`[SovereignGroundingStream] Brute-forcing MapSquare [${mx}, ${mz}] from Jagex Cache...`);
      
      this.cacheSubstrate.getIndexEntryById(cacheMajors.mapsquares, archId)
      .then(async (archInfo) => {
          if (!archInfo) {
               this.synthesisIndex.set(virtualKey, { name: "Void", objects: [] });
               return;
          }
          const arch = await this.cacheSubstrate!.getFileArchive(archInfo);
          const locsFile = arch.find(f => f.fileid === cacheMapFiles.locations);
          if (locsFile) {
              const locs = parse.mapsquareLocations.read(locsFile.buffer, this.cacheSubstrate!);
              normalized.objects = locs.locations.map((loc: any) => ({
                  ...loc,
                  id: loc.id,
                  type: 'object',
                  x: (mx * 64) + (loc.uses?.[0]?.x ?? 0),
                  z: (mz * 64) + (loc.uses?.[0]?.y ?? 0)
              }));
              this.synthesisIndex.set(virtualKey, normalized);
              console.log(`[SovereignGroundingStream] Materialized ${normalized.objects.length} objects from Cache.`);
          }
      })
      .catch(err => console.error(`[BruteForce] Extraction failed for [${mx}, ${mz}]:`, err))
      .finally(() => {
          // Keep it in pending for a few seconds to let the scene settle
          setTimeout(() => this.pendingMaterializations.delete(virtualKey), 5000);
      });

      return normalized;
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

  private async infiltrateLogic(entities: SynthesisEntity[]) {
      const { SovereignVarbitBridge } = await import('../logic/SovereignVarbitBridge');
      const bridge = SovereignVarbitBridge.getInstance();
      
      const varbitIds = new Set<number>();
      entities.forEach(e => {
          if (e.thickModelData?.varbitId) varbitIds.add(e.thickModelData.varbitId);
          if (e.thickModelData?.configId) varbitIds.add(e.thickModelData.configId);
          // Standard RS property mapping
          if ((e as any).varbitId) varbitIds.add((e as any).varbitId);
      });

      if (varbitIds.size > 0) {
          console.log(`[SovereignGroundingStream] Infiltrating ${varbitIds.size} Varbit Logics from Godhead...`);
          await bridge.batchExtract(Array.from(varbitIds));
      }
  }
}
