import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

async function probeRow2353() {
    console.log("🔍 Forensic Probe of Row 2353 (Sextant Reference)...");
    const source = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    
    try {
        const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
        const arch = await source.getFileArchive(archInfo);
        
        const file = arch.find(f => f.fileid === 2353);
        if (file) {
            console.log(`Found File 2353! Buffer size: ${file.buffer.length}`);
            const row = parse.dbrows.read(file.buffer, source) as any;
            console.log("Decoded Row Data:", JSON.stringify(row, null, 2));
            
            const colGroups = row.unk01?.columndata || row.unk02?.columndata;
            if (colGroups) {
                for (const group of colGroups) {
                    for (const col of group.columns) {
                        console.log(`Column Type ${col.type}: ${JSON.stringify(col.value)}`);
                    }
                }
            }
        } else {
            console.log("❌ File 2353 not found in archive.");
        }
    } catch (error) {
        console.error("❌ Probe failed:", error);
    } finally {
        source.close();
    }
}

probeRow2353().catch(console.error);
