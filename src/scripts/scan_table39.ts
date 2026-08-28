import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";
import Database from "better-sqlite3";
import * as path from "path";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const DB_PATH = path.join(process.cwd(), "rsmvCacheDB.sqlite");

async function scanAllTable39() {
    console.log("🚀 Starting Exhaustive Table 39 Forensic Scan...");
    const source = new GameCacheLoader(CACHE_DIR);
    
    try {
        const TABLE_ID = 39;
        const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
        const arch = await source.getFileArchive(archInfo);
        
        const tableRows = arch; // Scan EVERYTHING in the archive
        console.log(`Scanning all ${tableRows.length} rows in the archive...`);

        for (const file of tableRows) {
            try {
                const row = parse.dbrows.read(file.buffer, source) as any;
                const colGroups = row.unk01?.columndata || row.unk02?.columndata;
                const tableId = file.buffer.length >= 2 ? file.buffer[1] : -1;
                if (tableId === 122) continue; // Ignore legal text
                
                if (colGroups) {
                    let name: string = "";
                    let coord: any = null;
                    let foundNpcTip = false;
                    
                    for (const group of colGroups) {
                        for (const col of group.columns) {
                            if (col.type === 36) name = String(col.value?.[0]);
                            if (col.type === 33 || col.type === 22) coord = col.value?.[0];
                            if (col.type === 32) {
                                const val = Number(col.value?.[0]);
                                if (val === 4 || val === 47 || val === 252 || val === 488 || val === 6121 || val === 32322) {
                                    foundNpcTip = true;
                                }
                            }
                        }
                    }
                    
                    const lowName = name.toLowerCase();
                    if (lowName.includes("elf") || lowName.includes("prif")) {
                        console.log(`\n[FOUND] Table ${tableId}, Row ${file.fileid}: "${name}"`);
                        for (const group of colGroups) {
                            for (const col of group.columns) {
                                console.log(`  - Type: ${col.type}, Value: ${JSON.stringify(col.value)}`);
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip errors
            }
        }
    } catch (error) {
        console.error("❌ Scan failed:", error);
    } finally {
        source.close();
    }
}

scanAllTable39().catch(console.error);


