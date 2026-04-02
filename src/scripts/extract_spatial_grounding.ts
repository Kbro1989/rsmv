import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";
import Database from "better-sqlite3";
import * as path from "path";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";
const DB_PATH = path.join(process.cwd(), "rsmvCacheDB.sqlite");

function initDb() {
    const db = new Database(DB_PATH);
    db.exec(`
        CREATE TABLE IF NOT EXISTS grounded_entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            entity_id INTEGER,
            name TEXT,
            coord INTEGER,
            table_id INTEGER,
            row_id INTEGER,
            metadata TEXT
        )
    `);
    return db;
}

async function extract() {
    console.log("🚀 Starting Sovereign Spatial Grounding Extraction (Exhaustive Column Pass)...");
    const db = initDb();
    const source = new GameCacheLoader(CACHE_DIR);

    let npcsGrounded = 0;
    
    try {
        const TABLE_ID = 39;
        const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
        const arch = await source.getFileArchive(archInfo);
        
        const tableRows = arch.filter(f => f.buffer.length >= 2 && f.buffer[1] === TABLE_ID);
        console.log(`Found ${tableRows.length} potential rows for Table ${TABLE_ID}.`);

        const insert = db.prepare(`
            INSERT INTO grounded_entities (type, entity_id, name, coord, table_id, row_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const file of tableRows) {
            try {
                const row = parse.dbrows.read(file.buffer, source) as any;
                const colGroups = row.unk01?.columndata || row.unk02?.columndata;
                
                if (colGroups) {
                    let coord: number | null = null;
                    let name: string = "Unknown NPC";
                    let npcId: number = 0;

                    for (const group of colGroups) {
                        for (const col of group.columns) {
                            if (col.type === 33 || col.type === 22) {
                                if (col.value?.[0] !== undefined) coord = Number(col.value[0]);
                            }
                            if (col.type === 36) {
                                if (col.value?.[0] !== undefined) name = String(col.value[0]);
                            }
                            if (col.type === 32) {
                                if (col.value?.[0] !== undefined) npcId = Number(col.value[0]);
                            }
                        }
                    }
                    
                    if (coord !== null) {
                        const lowName = name.toLowerCase();
                        if (lowName.includes("professor") || lowName.includes("monster") || lowName.includes("npc")) {
                            console.log(`[!] FOUND: ${name} at ${coord} (npcId: ${npcId})`);
                        }
                        
                        insert.run("npc", npcId, name, coord, TABLE_ID, file.fileid);
                        npcsGrounded++;
                    }
                }
            } catch (e) {
                // Skip malformed rows
            }
        }
        
        console.log(`✅ Successfully grounded ${npcsGrounded} NPCs from Table ${TABLE_ID}.`);

    } catch (error) {
        console.error("❌ Extraction failed:", error);
    } finally {
        source.close();
        db.close();
    }
}

extract().catch(console.error);
