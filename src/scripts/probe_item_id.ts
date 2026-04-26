import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function probeItemById(targetId: number) {
    console.log(`🔍 Probing Item ID: ${targetId} in Major ${cacheMajors.items}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    // Archive ID = ItemID >> 8, SubFile ID = ItemID & 0xFF
    const archId = targetId >> 8;
    const subId = targetId & 0xFF;

    try {
        const index = await source.getCacheIndex(cacheMajors.items);
        const archInfo = index[archId];
        if (!archInfo) {
             console.error(`❌ Archive ${archId} not found in index.`);
             return;
        }

        const arch = await source.getFileArchive(archInfo);
        const file = arch.find(f => f.fileid === subId);
        if (!file) {
            console.error(`❌ Subfile ${subId} not found in archive ${archId}.`);
            return;
        }

        const itemRes = parse.item.read(file.buffer, source);
        console.log(`🎯 Found "${itemRes.name}" (ID ${targetId})`);
        console.log(`[JSON] ${JSON.stringify(itemRes, null, 2)}`);
    } catch (e) {
        console.error(`❌ Error probing item:`, e);
    } finally {
        source.close();
    }
}

const args = process.argv.slice(2);
const id = parseInt(args[0]) || 32845; // Default to normal seed if none provided

probeItemById(id).catch(console.error);


