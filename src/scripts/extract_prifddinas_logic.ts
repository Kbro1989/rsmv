import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const OUTPUT_PATH = "D:\\sovereign\\memory\\pedagogy\\prifddinas_grounding_raw.json";

// Prifddinas Coordinate Range (Focused District Search)
const PR_MIN_X = 2112;
const PR_MAX_X = 2432;
const PR_MIN_Y = 3264;
const PR_MAX_Y = 3584;

async function extract() {
    console.log("🚀 Starting Targeted Prifddinas Grounding Extraction...");
    const source = new GameCacheLoader(CACHE_DIR);
    const results: any[] = [];

    try {
        const TABLE_ID = 39; // NPC Grounding
        const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
        const arch = await source.getFileArchive(archInfo);
        
        console.log(`Auditing ${arch.length} DBRows for Table ${TABLE_ID}...`);

        for (const file of arch) {
            // Quick check for Table ID in the buffer (offset 1 is usually table ID in the simplest rows)
            if (file.buffer.length < 2 || file.buffer[1] !== TABLE_ID) continue;

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
                    
                    if (npcId === 19811 || npcId === 28257 || npcId === 20032) {
                        console.log(`[TARGET FOUND] ${name} (ID: ${npcId}) at Row: ${file.fileid}. RawCoord: ${coord}`);
                    }

                    if (coord !== null) {
                        const x = (coord >> 14) & 0x3FFF;
                        const y = coord & 0x3FFF;
                        const plane = (coord >> 28);

                        const lowName = name.toLowerCase();
                        const isPrif = lowName.includes("elf") || lowName.includes("prif") || lowName.includes("arian") || lowName.includes("amlodd") || lowName.includes("crwys");

                        if (isPrif) {
                            console.log(`[!] POSSIBLE TARGET: ${name} (${npcId}) at (${x}, ${y}, ${plane})`);
                            results.push({
                                npcId,
                                name,
                                x,
                                y,
                                plane,
                                rawCoord: coord,
                                rowId: file.fileid
                            });
                        }
                    }
                }
            } catch (e) {
                // Skip malformed rows
            }
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
        console.log(`✅ Successfully extracted ${results.length} entities to ${OUTPUT_PATH}`);

    } catch (error) {
        console.error("❌ Extraction failed:", error);
    } finally {
        source.close();
    }
}

extract().catch(console.error);

