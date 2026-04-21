import * as fs from "fs";
import * as path from "path";
import { GameCacheLoader } from "../cache/sqlite.js";
import { cacheMajors } from "../constants.js";
import { parse } from "../opdecoder.js";
import { archiveToFileId } from "../cache/index.js";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const PEDAGOGY_DIR = "D:\\sovereign\\memory\\pedagogy";
const MANIFEST_DIR = path.join(PEDAGOGY_DIR, "manifests");

async function materialize() {
    console.log("🚀 Starting Sovereign Thick Substrate Materialization...");
    const source = new GameCacheLoader(CACHE_DIR);

    if (!fs.existsSync(MANIFEST_DIR)) fs.mkdirSync(MANIFEST_DIR, { recursive: true });

    // 1. Materialize SpotAnims (Major 21) - chunked, 256 per archive
    await materializeChunked(source, cacheMajors.spotanims, parse.spotAnims, "spotanims.json", "SPOTANIM");

    // 2. Materialize Sequences (Major 20) - chunked, 128 per archive
    await materializeChunked(source, cacheMajors.sequences, parse.sequences, "sequences.json", "SEQ");

    source.close();
    console.log("✅ Materialization Complete.");
}

async function materializeChunked(source: GameCacheLoader, major: number, parser: any, fileName: string, prefix: string) {
    console.log(`📦 Materializing Major ${major} (${fileName}) [chunked]...`);
    const index = await source.getCacheIndex(major);
    const thickData: any[] = [];
    let totalEntries = 0;

    for (let archiveMinor = 0; archiveMinor < index.length; archiveMinor++) {
        if (!index[archiveMinor]) continue;
        try {
            const archive = await source.getFileArchive(index[archiveMinor]);
            for (const subfile of archive) {
                try {
                    const globalId = archiveToFileId(major, archiveMinor, subfile.fileid);
                    const parsed = parser.read(subfile.buffer, source);
                    thickData.push({
                        id: globalId,
                        ...parsed
                    });
                    totalEntries++;
                } catch (e) {
                    // Skip individual unparseable entries
                }
            }
        } catch (e) {
            // Skip archives that can't be loaded
        }
        if (archiveMinor % 5 === 0) console.log(`   Archive ${archiveMinor}/${index.length}... (${totalEntries} entries so far)`);
    }

    fs.writeFileSync(path.join(PEDAGOGY_DIR, fileName), JSON.stringify(thickData, null, 2));
    console.log(`   ✅ Done. Wrote ${totalEntries} entries to ${fileName}`);
}

materialize().catch(console.error);

