import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const TABLE_ID = 39;

async function probeTable39() {
    console.log(`🔍 Probing Table ${TABLE_ID} Metadata (Major ${cacheMajors.config}, Archive ${cacheConfigPages.dbtables})...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    // DBTables is under Major 2 (Config), Archive 40
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbtables];
    const arch = await source.getFileArchive(archInfo);
    const file = arch.find(f => f.fileid === TABLE_ID);

    if (file) {
        const table = parse.dbtables.read(file.buffer, source);
        console.log("Table Metadata Archive 40, File 39:");
        
        if (table.unk01) {
            console.log("\n--- unk01 ---");
            table.unk01.columndata.forEach((group: any, gi: number) => {
                console.log(`Group ${gi}: Flags=${group.flags}`);
                group.columns.forEach((col: any, ci: number) => {
                    console.log(`  Col ${ci}: Type=${col.type} Default=${col.default || "null"}`);
                });
            });
        }
        
        if (table.unk02) {
            console.log("\n--- unk02 ---");
            table.unk02.columndata.forEach((group: any, gi: number) => {
                console.log(`Group ${gi}: Flags=${group.flags}`);
                group.columns.forEach((col: any, ci: number) => {
                    console.log(`  Col ${ci}: Type=${col.type} Default=${col.defaultint || col.defaultstring || "null"}`);
                });
            });
        }
    } else {
        console.log(`Table ${TABLE_ID} not found.`);
    }
    
    source.close();
}

probeTable39().catch(console.error);


