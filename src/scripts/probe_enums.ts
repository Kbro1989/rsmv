import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function probeEnumById(targetId: number) {
    console.log(`🔍 Probing Enum ID: ${targetId} in Major ${cacheMajors.enums}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    // Archive ID = EnumID >> 8, SubFile ID = EnumID & 0xFF
    const archId = targetId >> 8;
    const subId = targetId & 0xFF;

    try {
        const index = await source.getCacheIndex(cacheMajors.enums);
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

        const enumRes = parse.enums.read(file.buffer, source);
        console.log(`🎯 Found Enum (ID ${targetId})`);
        console.log(`[JSON] ${JSON.stringify(enumRes, null, 2)}`);
    } catch (e) {
        console.error(`❌ Error probing enum:`, e);
    } finally {
        source.close();
    }
}

const args = process.argv.slice(2);
const id = parseInt(args[0]) || 4874; // Default to Prif destinations if none provided

probeEnumById(id).catch(console.error);


