import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../src/utils.ts';

const logger = createLogger('SpatialBridge');

const PUBLIC_DIR = join(process.cwd(), 'public');
const PEDAGOGY_DIR = 'pedagogy';
const MANIFEST_PATH = join(PUBLIC_DIR, 'authentic_spawn_manifest.json');
const ZONES_PATH = join(PEDAGOGY_DIR, 'mapzones_registry.json');

async function main() {
    logger.info('🚀 Starting Spatial Substrate Bridge (Grounding -> Heatmap)...');

    if (!existsSync(MANIFEST_PATH)) {
        logger.error(`Grounding manifest missing at ${MANIFEST_PATH}`);
        return;
    }

    // 1. Load Global Grounding Data
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    let zones: any[] = [];
    if (existsSync(ZONES_PATH)) {
        try {
            const rawZones = JSON.parse(readFileSync(ZONES_PATH, 'utf8'));
            // MapZones are typically an object with ID keys
            zones = Object.values(rawZones);
            logger.info(`Loaded ${zones.length} zone candidates from registry.`);
        } catch (e) {
            logger.warn('Failed to load mapzones_registry.json, skipping zones.');
        }
    }

    const entities = manifest.entities || [];
    const entityList = Array.isArray(entities) ? entities : Object.values(entities);
    logger.info(`Manifest contains ${entityList.length} total entities.`);
    
    // Debug first 3 entities
    entityList.slice(0, 3).forEach((e: any) => {
        logger.info(`Sample Entity: ID=${e.id}, Type=${typeof e.id}, Coord=${JSON.stringify(e.coord)}`);
    });

    const npcEntities = entityList.filter((e: any) => 
        e && (String(e.id).startsWith('npc_') || String(e.id).startsWith('landmark_') || String(e.id).startsWith('db_')) && e.coord && typeof e.coord.x === 'number'
    );

    logger.info(`Loaded ${npcEntities.length} grounded entities from manifest (Authentic + DB).`);

    // 2. Scan for Heatmap Assets
    const files = readdirSync(PUBLIC_DIR).filter(f => f.startsWith('ms_') && f.endsWith('.json'));
    logger.info(`Found ${files.length} mapsquare assets in public/`);

    for (const file of files) {
        const filePath = join(PUBLIC_DIR, file);
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        
        // Derive world coords — handle schemas: worldX/worldZ, rx/ry, or parse from filename
        const filenameMatch = file.match(/ms_(\d+)_(\d+)\.json/);
        const fileChunkX = filenameMatch ? parseInt(filenameMatch[1]) : undefined;
        const fileChunkZ = filenameMatch ? parseInt(filenameMatch[2]) : undefined;
        const chunkX = data.chunkX ?? data.rx ?? fileChunkX;
        const chunkZ = data.chunkZ ?? data.ry ?? fileChunkZ;
        const worldX = data.worldX ?? (typeof chunkX === 'number' ? chunkX * 64 : undefined);
        const worldZ = data.worldZ ?? (typeof chunkZ === 'number' ? chunkZ * 64 : undefined);

        if (worldX === undefined || worldZ === undefined) {
            logger.warn(`Skipping ${file} — cannot derive world coordinates.`);
            continue;
        }

        const minX = worldX;
        const maxX = worldX + 63;
        const minZ = worldZ;
        const maxZ = worldZ + 63;

        logger.info(`Processing ${file} (Bounds: ${minX}-${maxX}, ${minZ}-${maxZ})`);

        // 3. Filter NPCs for this Chunk
        const localNpcs = npcEntities.filter((e: any) => 
            e.coord.x >= minX && e.coord.x <= maxX &&
            e.coord.z >= minZ && e.coord.z <= maxZ
        ).map((e: any) => ({
            npcName: e.title || e.id,
            worldX: e.coord.x,
            worldZ: e.coord.z,
            plane: e.coord.plane || 0,
            confidence: e.grounded?.confidence || 1.0,
            id: e.id
        }));

        // 4. Filter MapZones for this Chunk
        const localZones = zones.filter((z: any) => {
            if (!z.bounds) return false;
            return z.bounds.some((b: any) => {
                const bMinX = b.src?.xstart ?? 0;
                const bMaxX = b.src?.xend ?? 0;
                const bMinZ = b.src?.zstart ?? 0;
                const bMaxZ = b.src?.zend ?? 0;
                // Overlap check
                return (bMinX <= maxX && bMaxX >= minX) && (bMinZ <= maxZ && bMaxZ >= minZ);
            });
        });

        // 5. Inject & Commit
        data.pedagogy = {
            npcs: localNpcs,
            zones: localZones,
            lastBridgeSync: Date.now(),
            source: 'Sovereign Manifest'
        };

        writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger.info(`Enriched ${file} with ${localNpcs.length} NPCs and ${localZones.length} Zones.`);
    }

    logger.info('Γ£à Spatial Substrate Bridge COMPLETE.');
}

main().catch(e => {
    logger.error('Bridge failed: ' + (e instanceof Error ? e.stack : String(e)));
});
