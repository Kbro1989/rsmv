import { GameCacheLoader } from "../../cache/sqlite";
import { cacheMajors } from "../../constants";
import { parse } from "../../opdecoder";
import * as path from "path";

const CACHE_DIR = path.resolve(__dirname, "../../../");
async function main() {
    console.log("🔍 OPERATION DECODE CACHE: Extracting Ground Truth Behavior Parameters...");

    const source = new GameCacheLoader();

    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("❌ Usage: npx tsx src/tools/auditors/extract_ground_truth_params.ts <npc|item> <id>");
        return;
    }

    const type = args[0].toLowerCase();
    const id = parseInt(args[1], 10);

    if (isNaN(id)) {
        console.error("❌ Invalid ID provided.");
        return;
    }

    const major = type === "npc" ? cacheMajors.npcs : cacheMajors.items;
    const archiveId = Math.floor(id / 256);
    const subId = id % 256;

    console.log(`📡 Fetching ${type.toUpperCase()} ${id} (Major: ${major}, Archive: ${archiveId}, Sub: ${subId})...`);

    try {
        const indexFile = await source.getCacheIndex(major);
        const index = indexFile[archiveId];
        if (!index) {
            console.error(`❌ Archive ${archiveId} not found in Major ${major}.`);
            return;
        }

        const subfiles = await source.getFileArchive(index);
        const file = subfiles.find(s => s.fileid === subId);
        
        if (!file) {
            console.error(`❌ Subfile ${subId} not found in Archive ${archiveId}.`);
            return;
        }

        const parser = type === "npc" ? parse.npc : parse.item;
        const config = parser.read(file.buffer, source);

        console.log(`\n--- [ FORENSIC RESULTS FOR ${type.toUpperCase()} ${id} ] ---`);
        console.log(`Name: ${config.name}`);
        
        // Output explicit bindings found only in 'extra' parameter block
        if (config.extra) {
            console.log(`\n✅ Explicit Mechanic Bindings (0xF9 params):`);
            // extra is usually an array of {key: number, intvalue: number, stringvalue: string}
            // or an object mapping like {"123": 456}
            console.log(JSON.stringify(config.extra, null, 2));
        } else {
            console.log(`\n❌ No explicit mechanic bindings found in 0xF9 params block.`);
        }
        
    } catch (err) {
        console.error("Error executing forensic extraction:", err);
    }
}

main();
