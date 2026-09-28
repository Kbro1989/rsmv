const { createServer } = require('http');
const { readFile, writeFile, mkdir, stat } = require('fs/promises');
const { join, extname, normalize } = require('path');
const { EngineCache } = require('../dist/3d/modeltothree');
const { GameCacheLoader } = require('../dist/cache/sqlite');

const CACHE_DIR = 'C:/ProgramData/Jagex/RuneScape';
const OUTPUT_DIR = './public/pog2/unified';

async function main() {
    console.log('Initializing cache...');
    const loader = new GameCacheLoader(CACHE_DIR);
    const engine = new EngineCache(loader);
    
    // Chunks to extract: [name, chunkX, chunkZ]
    const chunks = [
        ['ms_50_50', 50, 50],  // Lumbridge
        ['ms_32_1', 32, 1],    // Wilderness/Edgeville area
        ['ms_58_52', 58, 52],  // Rimmington/Port Sarim
    ];
    
    for (const [name, cx, cz] of chunks) {
        console.log(`\nExtracting ${name} (${cx},${cz})...`);
        
        try {
            const data = await extractMapsquare(engine, cx, cz);
            const outPath = join(OUTPUT_DIR, `${name}.json`);
            
            await mkdir(OUTPUT_DIR, { recursive: true });
            await writeFile(outPath, JSON.stringify(data, null, 2));
            
            console.log(`  Saved: ${outPath}`);
            console.log(`  tileFlags: ${data.tileFlags.length}`);
            console.log(`  objects: ${data.objects.length}`);
            console.log(`  objectDefs: ${Object.keys(data.objectDefs).length}`);
        } catch (e) {
            console.error(`  Error: ${e.message}`);
        }
    }
    
    await loader.close?.();
    console.log('\nDone.');
}

async function extractMapsquare(engine, chunkX, chunkZ) {
    const worldX = chunkX * 64;
    const worldZ = chunkZ * 64;
    
    // Get mapsquare data
    const mapData = await engine.getMapsquareData(chunkX, chunkZ);
    if (!mapData || !mapData.chunk) {
        throw new Error(`No mapsquare data for ${chunkX},${chunkZ}`);
    }
    
    const { tiles, nxttiles, rawlocs } = mapData.chunk;
    
    const tileFlags = [];
    const objects = [];
    const objectDefs = {};
    
    // Parse NXT tiles (modern format)
    if (nxttiles) {
        for (let plane = 0; plane < 4; plane++) {
            const levelArray = nxttiles[`level${plane}`];
            if (!levelArray) continue;
            
            for (let i = 0; i < levelArray.length; i++) {
                const tile = levelArray[i];
                if (!tile) continue;
                
                tileFlags.push({
                    x: Math.floor(i / 66),
                    z: i % 66,
                    plane: plane,
                    collision: tile.flags ?? 0,
                    height: tile.height ?? null,
                    overlay: tile.rest?.overlay ?? null,
                    underlay: tile.rest?.underlay ?? null,
                    shape: tile.rest?.shape ?? null,
                });
            }
        }
    }
    
    // Parse locations (object placements)
    if (rawlocs) {
        for (const loc of rawlocs) {
            const objectId = loc.id;
            
            // Cache object definition
            if (!objectDefs[objectId]) {
                try {
                    const objData = await engine.getFileById(16, objectId); // major 16 = objects
                    if (objData) {
                        const obj = engine.parse.object.read(objData, engine.rawsource);
                        objectDefs[objectId] = {
                            id: objectId,
                            name: obj.name ?? null,
                            actions: [
                                obj.actions_0 ?? null,
                                obj.actions_1 ?? null,
                                obj.actions_2 ?? null,
                                obj.actions_3 ?? null,
                                obj.actions_4 ?? null,
                            ],
                            type: obj.dummy_45 ?? null,
                            sizeX: obj.width ?? null,
                            sizeZ: obj.length ?? null,
                            solid: obj.maybe_blocks_movement ?? null,
                        };
                    }
                } catch {
                    // skip failed object defs
                }
            }
            
            // Add placements
            if (loc.uses) {
                for (const use of loc.uses) {
                    objects.push({
                        objectId: objectId,
                        x: use.x ?? 0,
                        z: use.y ?? 0,
                        plane: use.plane ?? 0,
                        rotation: use.rotation ?? 0,
                        type: use.type ?? 10,
                    });
                }
            }
        }
    }
    
    return {
        chunkX,
        chunkZ,
        worldX,
        worldZ,
        mapzone: null,
        mapzoneId: null,
        objects,
        tileFlags,
        objectDefs,
        pedagogy: { npcs: [], zones: [] },
        _meta: {
            source: CACHE_DIR,
            extractedAt: new Date().toISOString(),
            engine: 'rsmv-upstream-cache-server'
        }
    };
}

main().catch(console.error);
