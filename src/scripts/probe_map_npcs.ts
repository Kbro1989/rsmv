import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";

async function probeMapNpcs(zoneX: number, zoneY: number) {
    const zoneId = (zoneX << 8) | zoneY;
    console.log(`🔍 Probing Map Zone ${zoneX},${zoneY} (ID: ${zoneId}) in Major 5...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    try {
        const index = await source.getCacheIndex(cacheMajors.mapsquares);
        const archInfo = index[zoneId];
        
        if (!archInfo) {
            console.log("❌ Zone not found in index.");
            return;
        }

        const arch = await source.getFileArchive(archInfo);
        console.log(`Archive has ${arch.length} files.`);
        
        for (const file of arch) {
            // Target IDs: Arianwyn (19811/28257), Amlodd (20032)
            const targets = [19811, 28257, 20032, 20129];
            for (const id of targets) {
                // Search for ID as 16-bit int (Big Endian standard in map files)
                const needle = Buffer.from([(id >> 8) & 0xFF, id & 0xFF]);
                if (file.buffer.includes(needle)) {
                    console.log(`[FOUND] NPC ID ${id} in Map File ${file.fileid} (Zone: ${zoneX},${zoneY})`);
                }
            }
        }
    } catch (error) {
        console.error("❌ Probe failed:", error);
    } finally {
        source.close();
    }
}

// Observatory approx zone: 38, 49
const x = parseInt(process.argv[2]) || 38;
const y = parseInt(process.argv[3]) || 49;
probeMapNpcs(x, y).catch(console.error);

