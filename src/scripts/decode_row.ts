import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function decodeTargetRow(rowId: number) {
    const source = new GameCacheLoader(CACHE_DIR);
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const arch = await source.getFileArchive(archInfo);
    
    const file = arch.find(f => f.fileid === rowId);
    if (!file) {
        console.error(`Row ${rowId} not found`);
        return;
    }

    try {
        const row = parse.dbrows.read(file.buffer, source) as any;
        console.log(`Row ${rowId} (Table ${row.tableId}) decoded:`);
        console.log(JSON.stringify(row, null, 2));
    } catch (e) {
        console.error(`Failed to decode row ${rowId}:`, e);
    }
    source.close();
}

const rowId = parseInt(process.argv[2] || "8447");
decodeTargetRow(rowId).catch(console.error);
