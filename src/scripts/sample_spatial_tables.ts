import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const TABLES_TO_PROBE = [22, 316, 329, 341];

async function sampleSpatialTables() {
    console.log(`🔍 Sampling Spatial Tables: ${TABLES_TO_PROBE.join(", ")}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const arch = await source.getFileArchive(archInfo);

    for (const tableId of TABLES_TO_PROBE) {
        console.log(`\n--- Table ${tableId} Samples ---`);
        const tableRows = arch.filter(f => f.buffer.length >= 2 && f.buffer[1] === tableId);
        console.log(`Found ${tableRows.length} rows.`);

        for (let i = 0; i < Math.min(5, tableRows.length); i++) {
            const file = tableRows[i];
            try {
                const row = parse.dbrows.read(file.buffer, source) as any;
                const colGroups = row.unk01?.columndata || row.unk02?.columndata;
                console.log(`Row ${file.fileid}:`);
                if (colGroups) {
                    colGroups.forEach((group: any) => {
                        group.columns.forEach((col: any) => {
                            if ([33, 22, 30, 32, 36, 1].includes(col.type)) {
                                console.log(`  Type ${col.type}: ${col.value}`);
                            }
                        });
                    });
                }
            } catch (e) { }
        }
    }

    source.close();
}

sampleSpatialTables().catch(console.error);

