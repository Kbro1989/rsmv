/**
 * probe_lootbeam_v2.ts
 * 
 * Focused probe: Find what SpotAnim the golden loot beam uses.
 * 
 * Approach:
 * 1. Get golden loot beam item (model=74985), extract extra params
 * 2. Probe ALL spotAnims whose model matches 74985 (the default beam model from item cache)
 * 3. Print the IDs, sequences, and scale factors for beam tier sizing
 * 4. Also probe for any spotAnims that might reference the golden beam item ID via replace_colors
 */
import { GameCacheLoader } from "../cache/sqlite.js";
import { parse } from "../opdecoder.js";
import { cacheMajors } from "../constants.js";
import { writeFileSync } from "fs";
import { join } from "path";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

// From previous probe: golden loot beam item model = 74985
const TARGET_MODELS = [74985, 137202, 137203, 74984, 74986, 74987, 74988];

async function run() {
    const source = new GameCacheLoader(CACHE_DIR);

    // PASS 1: Item extra params for all loot beam items
    console.log("=== PASS 1: All loot beam item extra params ===");
    const allBeamItems: any[] = [];
    const itemIndex = await source.getCacheIndex(cacheMajors.items);
    for (const file of itemIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const item of arch) {
                try {
                    const parsed = parse.item.read(item.buffer, source);
                    const name: string = parsed.name ?? "";
                    if (name.toLowerCase().includes("loot beam")) {
                        const entry = {
                            id: item.fileid,
                            name,
                            baseModel: parsed.baseModel,
                            extra: parsed.extra
                        };
                        allBeamItems.push(entry);
                        console.log(JSON.stringify(entry));
                    }
                } catch(e) {}
            }
        } catch(e) {}
    }
    
    // PASS 2: SpotAnims matching known beam models
    console.log("\n=== PASS 2: SpotAnims using beam models ===");
    const beamSpotAnims: any[] = [];
    const spotIndex = await source.getCacheIndex(cacheMajors.spotanims);
    let total = 0;
    for (const file of spotIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const entry of arch) {
                try {
                    const sa = parse.spotAnims.read(entry.buffer, source);
                    total++;
                    if (TARGET_MODELS.includes(sa.model)) {
                        const row = {
                            id: entry.fileid,
                            model: sa.model,
                            sequence: sa.sequence,
                            scaleX: sa.scaleX ?? undefined,
                            scaleYorZ: sa.scaleYorZ ?? undefined,
                            unk2e: !!sa.unk2e,
                            replace_colors: sa.replace_colors ?? []
                        };
                        beamSpotAnims.push(row);
                        console.log(JSON.stringify(row));
                    }
                } catch(e) {}
            }
        } catch(e) {}
    }
    console.log(`Scanned ${total} spotAnims total. Found ${beamSpotAnims.length} beam matches.`);

    // PASS 3: Write full results to file for analysis
    const out = { beamItems: allBeamItems, beamSpotAnims };
    const outPath = join(process.cwd(), "audit_output", "loot_beam_forensics.json");
    try { writeFileSync(outPath, JSON.stringify(out, null, 2)); console.log(`\nOutput: ${outPath}`); } catch(e) {}
}

run().catch(console.error);
