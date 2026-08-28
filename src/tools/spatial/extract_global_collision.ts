import { GameCacheLoader } from "../../cache/sqlite";
import { cacheMapFiles } from "../../constants";
import { parse } from "../../opdecoder";
import * as fs from "fs";
import * as path from "path";

const POG_ROOT = path.resolve(__dirname, "../../../../");

async function extractGlobalCollision() {
    const cachePath = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
    const loader = new GameCacheLoader(cachePath);

    const mapIndex = await loader.getCacheIndex(5); // Mapsquares
    const validRegions = Object.keys(mapIndex)
        .map(Number)
        .filter(n => !isNaN(n));

    console.log(`[Global Extractor] Found ${validRegions.length} valid map regions in Cache.`);
    
    const outDir = path.join(POG_ROOT, 'atlas', 'spatial', 'regions');
    fs.mkdirSync(outDir, { recursive: true });

    let processed = 0;
    let skipped = 0;

    for (const regionId of validRegions) {
        const rx = regionId >> 8;
        const ry = regionId & 0xff;
        const archive = mapIndex[regionId];

        if (!archive) {
            skipped++;
            continue;
        }

        try {
            const files = await loader.getFileArchive(archive);

            const terrainFile = files.find(f => f.fileid === cacheMapFiles.squares);
            const locationFile = files.find(f => f.fileid === cacheMapFiles.locations);

            if (!terrainFile || !locationFile) {
                skipped++;
                continue;
            }

            const terrain = parse.mapsquareTiles.read(terrainFile.buffer, loader, { buildnr: 927 });
            const locations = parse.mapsquareLocations.read(locationFile.buffer, loader);

            const matrix: Record<string, any> = {};
            const stride = 64;
            const tilesPerLevel = 64 * 64;
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
                        
                        matrix[key] = { north: true, south: true, east: true, west: true, mask: 0 };

                        const settings = tile.settings ?? 0;
                        if (settings & 1) {
                            matrix[key] = { north: false, south: false, east: false, west: false, mask: 0x200000 };
                        }
                    }
                }
            }

            // Object pass
            for (const locGroup of locations.locations) {
                const objId = locGroup.id;
                let objDef: any;
                try {
                    const data = await loader.getFile(2, objId); 
                    objDef = parse.object.read(data, loader);
                } catch { continue; }
                
                for (const use of locGroup.uses) {
                    const worldX = baseX + use.x;
                    const worldY = baseY + use.y;
                    const key = `${use.plane}_${worldX}_${worldY}`;
                    if (!matrix[key]) continue;

                    const rotation = use.rotation;
                    const type = use.type;

                    if (type >= 0 && type <= 3) {
                        matrix[key].mask |= 0x100; // Flag it as having a collision object
                        if (rotation === 0) matrix[key].west = false;
                        if (rotation === 1) matrix[key].north = false;
                        if (rotation === 2) matrix[key].east = false;
                        if (rotation === 3) matrix[key].south = false;
                    } else if (type === 10 && !objDef.probably_nocollision) {
                        matrix[key].mask |= 0x100;
                        matrix[key].north = matrix[key].south = matrix[key].east = matrix[key].west = false;
                    }
                }
            }

            const outPath = path.join(outDir, `ms_${rx}_${ry}.json`);
            fs.writeFileSync(outPath, JSON.stringify(matrix, null, 0));
            processed++;

            if (processed % 100 === 0) {
                console.log(`  ... Processed ${processed}/${validRegions.length} regions...`);
            }

        } catch (e) {
            skipped++;
        }
    }

    console.log(`\n✅ Global Synthesis Complete:`);
    console.log(`  Parsed: ${processed} regions`);
    console.log(`  Skipped (No valid subfile/archive): ${skipped} regions`);
    console.log(`  Output Path: ${outDir}`);
}

extractGlobalCollision().catch(console.error);


