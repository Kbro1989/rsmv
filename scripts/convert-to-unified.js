const path = require('path');
const fs = require('fs');

// Change to project root
process.chdir(path.join(__dirname, '..'));

function convertChunk(chunkX, chunkZ, maptilesPath, maplocationsPath) {
    console.log(`\nConverting ms_${chunkX}_${chunkZ}...`);
    
    const maptiles = JSON.parse(fs.readFileSync(maptilesPath, 'utf8'));
    const maplocations = JSON.parse(fs.readFileSync(maplocationsPath, 'utf8'));
    
    const worldX = chunkX * 64;
    const worldZ = chunkZ * 64;
    
    // Convert tiles to tileFlags
    const tileFlags = [];
    const tiles = maptiles.tiles || [];
    
    for (let plane = 0; plane < 4; plane++) {
        for (let z = 0; z < 64; z++) {
            for (let x = 0; x < 64; x++) {
                const idx = plane * 4096 + (z * 64 + x);
                const tile = tiles[idx];
                if (!tile) continue;
                
                tileFlags.push({
                    x: x,
                    z: z,
                    plane: plane,
                    collision: tile.flags ?? 0,
                    height: tile.height ?? null,
                    overlay: tile.overlay ?? null,
                    underlay: tile.underlay ?? null,
                    shape: tile.shape ?? null
                });
            }
        }
    }
    
    // Convert locations to objects
    const objects = [];
    const locations = maplocations.locations || [];
    
    for (const loc of locations) {
        if (!loc.uses) continue;
        for (const use of loc.uses) {
            objects.push({
                objectId: loc.id,
                x: use.x,
                z: use.y,
                plane: use.plane,
                rotation: use.rotation,
                type: use.type
            });
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
        objectDefs: {},
        pedagogy: { npcs: [], zones: [] },
        _meta: {
            source: 'C:\\ProgramData\\Jagex\\RuneScape',
            extractedAt: new Date().toISOString(),
            engine: 'rsmv-upstream-extract'
        }
    };
}

// Process all chunks
const chunks = [
    { cx: 50, cz: 50, mt: 'extracted_layers/maptiles_test/maptiles-50_50.json', ml: 'extracted_layers/maplocations_test/maplocations-50_50.json' },
    { cx: 58, cz: 52, mt: 'extracted_layers/maptiles_more/maptiles-58_52.json', ml: 'extracted_layers/maplocations_58_52/maplocations-58_52.json' }
];

const outputDir = path.join(__dirname, '../public/pog2/unified');
fs.mkdirSync(outputDir, { recursive: true });

for (const { cx, cz, mt, ml } of chunks) {
    try {
        const unified = convertChunk(cx, cz, mt, ml);
        const outPath = path.join(outputDir, `ms_${cx}_${cz}.json`);
        fs.writeFileSync(outPath, JSON.stringify(unified, null, 2));
        
        const stats = fs.statSync(outPath);
        console.log(`  Saved: ${outPath} (${(stats.size / 1024).toFixed(1)} KB)`);
        console.log(`  tileFlags: ${unified.tileFlags.length}`);
        console.log(`  objects: ${unified.objects.length}`);
    } catch (e) {
        console.error(`  Error: ${e.message}`);
    }
}

console.log('\nDone.');
