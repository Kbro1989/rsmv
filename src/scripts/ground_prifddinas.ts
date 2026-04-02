import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";
const PRIIF_LODESTONE_ID = 93371;

async function groundPrifddinas() {
    console.log("🧬 Grounding Prifddinas Anchors (High Fidelity)...");
    const source = new GameCacheLoader(CACHE_DIR);
    
    // Major 5 (Mapsquares)
    const index = await source.getCacheIndex(cacheMajors.mapsquares);

    // Specific Prifddinas regions (Prifddinas is mostly around 26, 163 and 27, 163)
    // We'll scan a 4x4 block to be safe
    const targetX = 26;
    const targetY = 163;
    
    for (let x = targetX - 1; x <= targetX + 1; x++) {
        for (let y = targetY - 1; y <= targetY + 1; y++) {
            const archId = (x << 8) | y;
            const archInfo = index[archId];
            if (!archInfo) continue;

            console.log(`Checking Region [${x}, ${y}] (Archive ${archId})...`);
            const arch = await source.getFileArchive(archInfo);
            const locFile = arch.find(f => f.fileid === 0);
            if (!locFile) continue;

            try {
                const locs = parse.mapsquareLocations.read(locFile.buffer, source);
                for (const loc of locs.locations) {
                    for (const use of loc.uses) {
                        const worldX = (x * 64) + use.x;
                        const worldY = (y * 64) + use.y;

                        // Lodestone
                        if (loc.id === PRIIF_LODESTONE_ID || loc.id === 93372) {
                            console.log(`🎯 [ANCHOR] [LODESTONE] ID ${loc.id} at (${worldX}, ${worldY}, ${use.plane})`);
                        }

                        // Voice of Seren Crystals and Fairy Ring
                        if ((loc.id >= 92531 && loc.id <= 92545) || (loc.id >= 92380 && loc.id <= 92395)) {
                             let type = "UNKNOWN";
                             if (loc.id === 92531) type = "FAIRY_RING";
                             else if (loc.id >= 92533) type = "ACTIVE_VOICESTONE";
                             else type = "BASE_VOICESTONE";
                             
                             console.log(`🎯 [ANCHOR] [${type}] ID ${loc.id} at (${worldX}, ${worldY}, ${use.plane})`);
                        }
                    }
                }
            } catch (e) {
                // Ignore decoding errors for non-location files if index was messy
            }
        }
    }
    
    source.close();
    console.log("🧬 Grounding Complete.");
}

groundPrifddinas().catch(console.error);
