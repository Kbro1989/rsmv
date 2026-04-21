import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Resolve paths to RSMV substrate (Sovereign Inspector)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POG_ROOT = path.resolve(__dirname, '../../../../');

// Import RSMV logic from the Sovereign substrate natively
import { GameCacheLoader } from '../../cache/sqlite';
import { parse } from '../../opdecoder';
import { cacheMapFiles } from '../../constants';

async function extractDirectionalCollision(regionId: number) {
    const cachePath = "C:\ProgramData\Jagex\RuneScape";
    const loader = new GameCacheLoader(cachePath);
    
    // 1. Resolve coordinates from region ID
    const x = (regionId >> 8) & 0xFF;
    const y = regionId & 0xFF;
    // 2. Locate map files (Index 5)
    // Archive ID is the regionId. Subfiles: 3 = terrain, 0 = locations
    const mapIndex = 5;
    const index = await loader.getCacheIndex(mapIndex);
    const archive = index[regionId];

    if (!archive) {
        console.error(`Could not find map archive for region ${regionId}`);
        return;
    }

    const files = await loader.getFileArchive(archive);

    // Subfile 3 = terrain tiles, Subfile 0 = locations
    const terrainFile = files.find(f => f.fileid === cacheMapFiles.squares);
    const locationFile = files.find(f => f.fileid === cacheMapFiles.locations);

    if (!terrainFile || !locationFile) {
        console.error(`Missing terrain or location subfile in archive ${regionId}`);
        return;
    }

    console.log(`[Forensics] Terrain subfile 3: ${terrainFile.buffer.length} bytes, Location subfile 0: ${locationFile.buffer.length} bytes`);

    // Standard parser: 16384 tiles = 4 levels × 64 × 64, flat array
    const terrain = parse.mapsquareTiles.read(terrainFile.buffer, loader, { buildnr: 927 });
    const locations = parse.mapsquareLocations.read(locationFile.buffer, loader);

    // 3. Synthesis Matrix
    const matrix: any = {};
    const stride = 64;
    const tilesPerLevel = 64 * 64; // 4096
    
    const rx = regionId >> 8;
    const ry = regionId & 0xff;
    const baseX = rx * 64;
    const baseY = ry * 64;

    for (let plane = 0; plane < 4; plane++) {
        for (let ty = 0; ty < 64; ty++) {
            for (let tx = 0; tx < 64; tx++) {
                const tileIndex = (plane * tilesPerLevel) + (ty * stride) + tx;
                const tile = terrain.tiles?.[tileIndex];
                if (!tile) continue;

                const worldX = baseX + tx;
                const worldY = baseY + ty;
                const key = `${plane}_${worldX}_${worldY}`;
                
                matrix[key] = {
                    north: true, south: true, east: true, west: true
                };

                // Bit 0x01 in settings = blocked tile (from upstream: 1=visible, but settings bit 1 = block)
                // The standard parser uses "settings" field, not "flags"
                const settings = tile.settings ?? 0;
                if (settings & 1) {
                    matrix[key] = { north: false, south: false, east: false, west: false };
                }
            }
        }
    }

    // Process Locations (Walls & Objects) — NPCs have no collision
    for (const locGroup of locations.locations) {
        const objId = locGroup.id;
        let objDef: any;
        try {
            objDef = await getObjectDef(loader, objId);
        } catch { continue; }
        
        if (!objDef.maybe_blocks_movement && !objDef.probably_nocollision) {
            // Object has default collision (solid) unless probably_nocollision is set
        }

        for (const use of locGroup.uses) {
            const worldX = baseX + use.x;
            const worldY = baseY + use.y;
            const key = `${use.plane}_${worldX}_${worldY}`;
            if (!matrix[key]) continue;

            const rotation = use.rotation;
            const type = use.type;

            // Type 0-3: Wall logic (directional blocking)
            if (type >= 0 && type <= 3) {
                if (rotation === 0) matrix[key].west = false;
                if (rotation === 1) matrix[key].north = false;
                if (rotation === 2) matrix[key].east = false;
                if (rotation === 3) matrix[key].south = false;
            } 
            // Type 10: Standard solid object (full block)
            else if (type === 10 && !objDef.probably_nocollision) {
                matrix[key].north = matrix[key].south = matrix[key].east = matrix[key].west = false;
            }
        }
    }

    // 4. Export Artifact
    const outDir = path.join(POG_ROOT, 'atlas', 'spatial');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `directional_${regionId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(matrix, null, 2));
    console.log(`Exported ${Object.keys(matrix).length} tile entries for region ${regionId} to ${outPath}`);
}

async function getObjectDef(loader: any, id: number) {
    const data = await loader.getFile(2, id); // Index 2 = Configs
    return parse.object.read(data, loader);
}

const args = process.argv.slice(2);
let targetRegion = 6819; // Default: Prifddinas Loadstone Region

if (args.length >= 2) {
    const targetX = parseInt(args[0], 10);
    const targetY = parseInt(args[1], 10);
    const rx = Math.floor(targetX / 64);
    const ry = Math.floor(targetY / 64);
    targetRegion = (rx << 8) | ry;
    console.log(`Resolved Absolute Coordinates [X: ${targetX}, Y: ${targetY}] to Region ID: ${targetRegion}`);
} else if (args.length === 1) {
    targetRegion = parseInt(args[0], 10);
}

extractDirectionalCollision(targetRegion).catch(console.error);

