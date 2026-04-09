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

async function extractDirectionalCollision(regionId: number) {
    const cachePath = "C:\\ProgramData\\Jagex\\RuneScape";
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
    const terrainData = files[3]?.buffer; // Subfile 3: Terrain
    const locationData = files[0]?.buffer; // Subfile 0: Locations

    if (!terrainData || !locationData) {
        console.error(`Missing required subfiles in archive ${regionId}`);
        return;
    }
    
    const terrain = parse.mapsquareTiles.read(Buffer.from(terrainData), loader);
    const locations = parse.mapsquareLocations.read(Buffer.from(locationData), loader);

    // 3. Synthesis Matrix
    const matrix: any = {};

    // Process Terrain first (Level 0)
    for (let i = 0; i < terrain.level0.length; i++) {
        const tile = terrain.level0[i];
        // NXT Stride is 66 (1 tile padding on each side)
        const tx = (i % 66) - 1;
        const ty = (Math.floor(i / 66) % 66) - 1;
        const plane = Math.floor(i / 4356);
        
        // Skip padding tiles (only process 0-63)
        if (tx < 0 || tx >= 64 || ty < 0 || ty >= 64) continue;

        const key = `${plane}_${tx}_${ty}`;
        matrix[key] = {
            north: true, south: true, east: true, west: true,
            npc_only: []
        };

        // NXT Bit 0x2: Blocking
        if (tile.flags != null && (tile.flags & 0x02)) {
            matrix[key] = { north: false, south: false, east: false, west: false, npc_only: [] };
        }
    }

    // Process Locations (Walls & Objects)
    for (const locGroup of locations.locations) {
        const objId = locGroup.id;
        const objDef = await getObjectDef(loader, objId);
        
        if (!objDef.maybe_blocks_movement) continue;

        for (const use of locGroup.uses) {
            const key = `${use.plane}_${use.x}_${use.y}`;
            if (!matrix[key]) continue;

            const rotation = use.rotation;
            const type = use.type;

            // Type 0-3: Wall logic
            if (type >= 0 && type <= 3) {
                if (rotation === 0) matrix[key].west = false;
                if (rotation === 1) matrix[key].north = false;
                if (rotation === 2) matrix[key].east = false;
                if (rotation === 3) matrix[key].south = false;
            } 
            // Type 10: Standard Object (Full Block)
            else if (type === 10) {
                matrix[key].north = matrix[key].south = matrix[key].east = matrix[key].west = false;
            }
        }
    }

    // 4. Export Artifact
    const outPath = path.join(POG_ROOT, 'atlas', 'spatial', `directional_${regionId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(matrix, null, 2));
    console.log(`Exported Directional Sovereignty for ${regionId} to ${outPath}`);
}

async function getObjectDef(loader: any, id: number) {
    const data = await loader.getFile(2, id); // Index 2 = Configs
    return parse.object.read(data, loader);
}

// Example: Prifddinas (8755)
extractDirectionalCollision(8755).catch(console.error);
