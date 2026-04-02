import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors, cacheConfigPages } from "../constants";
import { parse } from "../opdecoder";
import * as fs from "fs";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";
const OUTPUT_PATH = "D:\\sovereign\\memory\\pedagogy\\prifddinas_research_results.json";

async function research() {
    console.log("🔍 Starting Deep Research for Prifddinas Interaction Nodes...");
    const source = new GameCacheLoader(CACHE_DIR);
    const results: any = {
        npcs: [],
        objects: [],
        enums: [],
        tables: {}
    };

    const keywords = ["prif", "arian", "amlodd", "crwys", "cadarn", "hefin", "iorwerth", "ithell", "meilyr", "trahaearn", "morvran", "max guild", "seren"];

    try {
        // 1. Scan DBRows for NPCs and Objects
        const archInfo = (await source.getCacheIndex(cacheMajors.config))[cacheConfigPages.dbrows];
        const arch = await source.getFileArchive(archInfo);
        
        console.log(`Scanning ${arch.length} DBRows...`);

        for (const file of arch) {
            try {
                const row = parse.dbrows.read(file.buffer, source) as any;
                const tableId = file.buffer[1]; // Simple heuristic for table ID
                
                const colGroups = row.unk01?.columndata || row.unk02?.columndata;
                if (!colGroups) continue;

                let name = "";
                let id = 0;
                let coord: number | null = null;

                for (const group of colGroups) {
                    for (const col of group.columns) {
                        if (col.type === 36) name = String(col.value?.[0] || "");
                        if (col.type === 32) id = Number(col.value?.[0] || 0);
                        if (col.type === 33 || col.type === 22) coord = Number(col.value?.[0] || null);
                    }
                }

                const lowName = name.toLowerCase();
                const match = keywords.some(k => lowName.includes(k));

                if (match) {
                    const data: any = { tableId, id, name, rowId: file.fileid };
                    if (coord !== null) {
                        data.x = (coord >> 14) & 0x3FFF;
                        data.y = coord & 0x3FFF;
                        data.plane = (coord >> 28);
                    }

                    if (tableId === 39) results.npcs.push(data);
                    else if (tableId === 40) results.objects.push(data);
                    else {
                        if (!results.tables[tableId]) results.tables[tableId] = [];
                        results.tables[tableId].push(data);
                    }
                }
            } catch (e) { /* skip */ }
        }

        // 2. Scan Enums for Prifddinas Logic
        console.log("Scanning Enums...");
        const enumIndex = (await source.getCacheIndex(cacheMajors.enums))[0];
        const enumArch = await source.getFileArchive(enumIndex);

        for (const file of enumArch) {
            try {
                const e = parse.enums.read(file.buffer, source) as any;
                let found = false;
                if (e.intArray) {
                    // Check if any integer values look like Prifddinas NPC/Object IDs we found
                }
                if (e.stringArray) {
                    for (const s of Object.values(e.stringArray)) {
                        const lowS = String(s).toLowerCase();
                        if (keywords.some(k => lowS.includes(k))) {
                            found = true;
                            break;
                        }
                    }
                }

                if (found) {
                    results.enums.push({ id: file.fileid, data: e });
                }
            } catch (e) { /* skip */ }
        }

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
        console.log(`✅ Research complete. Results saved to ${OUTPUT_PATH}`);

    } catch (error) {
        console.error("❌ Research failed:", error);
    } finally {
        source.close();
    }
}

research().catch(console.error);
