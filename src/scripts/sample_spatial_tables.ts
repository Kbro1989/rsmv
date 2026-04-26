import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const TABLES_TO_PROBE = [39, 22, 8961];

async function sampleSpatialTables() {
    console.log(`🔍 Sampling Spatial Tables: ${TABLES_TO_PROBE.join(", ")}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
    const arch = await source.getFileArchive(archInfo);

    for (const tableId of TABLES_TO_PROBE) {
        console.log(`\n--- Table ${tableId} Samples ---`);
        const tableRows = arch.filter(f => {
            const hex = f.buffer.toString('hex');
            const tableHex = tableId < 0x80 ? tableId.toString(16).padStart(2, '0') : ((tableId >> 8) | 0x80).toString(16).padStart(2, '0') + (tableId & 0xff).toString(16).padStart(2, '0');
            return hex.includes("04" + tableHex);
        });
        console.log(`Found ${tableRows.length} rows.`);

        for (let i = 0; i < Math.min(5, tableRows.length); i++) {
            const file = tableRows[i];
            try {
                const row = parse.dbrows.read(file.buffer, source) as any;
                console.log(`Row ${file.fileid} (Table: ${row.tableId}):`);
                for (let g = 1; g <= 3; g++) {
                    const group = row[`group${g}`];
                    if (group && group.columndata) {
                        group.columndata.forEach((rowEntry: any) => {
                            rowEntry.columns.forEach((col: any) => {
                                console.log(`  G${g} RowId ${rowEntry.id} Col ${col.type}: ${JSON.stringify(col.value)}`);
                            });
                        });
                    }
                }
            } catch (e: any) { 
                console.log(`  Error decoding row ${file.fileid}: ${e.message}`);
                // Try to see where it failed
                try {
                    const state = { isWrite: false, buffer: file.buffer, scan: 0, endoffset: file.buffer.length, stack: [], hiddenstack: [], args: {} };
                    parse.dbrows.readInternal(state as any);
                } catch (e2: any) {
                    // This is internal, but we can't easily get the scan position without modifying opdecoder
                }
                console.log(`  Buffer: ${file.buffer.toString('hex')}`);
            }
        }
    }

    source.close();
}

sampleSpatialTables().catch(console.error);


