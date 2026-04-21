import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";

async function probeAllTables() {
    console.log(`🔍 Probing ALL DBTables for Spatial Columns (Major ${cacheMajors.config}, Archive ${cacheConfigPages.dbtables})...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbtables];
    const arch = await source.getFileArchive(archInfo);

    const spatialTables: any[] = [];

    for (const file of arch) {
        try {
            const table = parse.dbtables.read(file.buffer, source);
            let isSpatial = false;
            const columns: any[] = [];

            const processGroup = (group: any) => {
                group.columndata.forEach((colGroup: any) => {
                    colGroup.columns.forEach((col: any) => {
                        columns.push(col.type);
                        if (col.type === 33 || col.type === 22) isSpatial = true; 
                    });
                });
            };

            if (table.unk01) processGroup(table.unk01);
            if (table.unk02) processGroup(table.unk02);

            if (isSpatial) {
                spatialTables.push({ id: file.fileid, columns });
            }
        } catch (e) { }
    }

    console.log(`\n🎯 Found ${spatialTables.length} spatial tables:`);
    spatialTables.forEach(t => {
        console.log(`Table ${t.id}: Columns [${t.columns.join(", ")}]`);
    });

    source.close();
}

probeAllTables().catch(console.error);

