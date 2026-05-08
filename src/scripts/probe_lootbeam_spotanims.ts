/**
 * probe_lootbeam_spotanims.ts
 * 
 * Forensic probe: Extract SpotAnim IDs used by loot beams from the Jagex cache.
 *
 * Strategy:
 * 1. Find all items that are loot beams (golden loot beam model = 74985)
 * 2. Examine their `extra` params for spotAnim references (param 4414 used in cosmetic items)
 * 3. Directly search spotAnims for ones that use models matching known loot beam models
 * 4. Also probe spotAnims near known relevant IDs for beam-like characteristics (additive blend / unk2e)
 * 
 * Source of truth: C:\ProgramData\Jagex\RuneScape
 */

import { GameCacheLoader } from "../cache/sqlite.js";
import { parse } from "../opdecoder.js";
import { cacheMajors } from "../constants.js";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

// Known loot beam model IDs from cache probe (golden=74985, frozen=137202, warped=137203)
const KNOWN_BEAM_MODELS = new Set([74985, 137202, 137203]);

// SpotAnim IDs to always print (widen range around known necromancy anims for context)
const PROBE_RANGE_START = 1;
const PROBE_RANGE_END   = 200; // Initial probe of low IDs; beams may have low IDs

async function run() {
    const source = new GameCacheLoader(CACHE_DIR);

    // ---------------------------------------------------------------
    // PASS 1: Find items with loot beam models, extract extra params
    // ---------------------------------------------------------------
    console.log("\n=== PASS 1: Loot beam Items & Extra Params ===");
    const itemIndex = await source.getCacheIndex(cacheMajors.items);
    for (const file of itemIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const item of arch) {
                try {
                    const parsed = parse.item.read(item.buffer, source);
                    const name: string = parsed.name ?? "";
                    if (name.toLowerCase().includes("loot beam")) {
                        console.log(`\nItem ${item.fileid}: "${name}"`);
                        console.log(`  baseModel: ${parsed.baseModel}`);
                        if (parsed.extra && parsed.extra.length > 0) {
                            console.log("  extra params:");
                            for (const p of parsed.extra) {
                                console.log(`    prop=${p.prop} int=${p.intvalue} str=${p.stringvalue}`);
                            }
                        }
                    }
                } catch(e) {}
            }
        } catch(e) {}
    }

    // ---------------------------------------------------------------
    // PASS 2: Scan ALL SpotAnims for models matching known beam models
    //         AND for the unk2e (additive blend) flag
    // ---------------------------------------------------------------
    console.log("\n\n=== PASS 2: SpotAnims using known beam models or additive blend ===");
    const spotIndex = await source.getCacheIndex(cacheMajors.spotanims);
    let scanned = 0;
    const results: Array<{id: number, model: number, seq: number, unk2e: boolean, scaleX?: number, scaleY?: number}> = [];

    for (const file of spotIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const entry of arch) {
                try {
                    const sa = parse.spotAnims.read(entry.buffer, source);
                    scanned++;
                    const isBeamModel = sa.model !== undefined && sa.model !== null && KNOWN_BEAM_MODELS.has(sa.model);
                    const isAdditive = !!sa.unk2e; // billboard/additive blend = beam-like visual

                    if (isBeamModel || isAdditive) {
                        results.push({
                            id: entry.fileid,
                            model: sa.model ?? 0,
                            seq: sa.sequence ?? 0,
                            unk2e: isAdditive,
                            scaleX: sa.scaleX ?? undefined,
                            scaleY: sa.scaleYorZ ?? undefined
                        });
                    }
                } catch(e) {}
            }
        } catch(e) {}
    }

    console.log(`Scanned ${scanned} SpotAnims. Found ${results.length} beam-like entries.`);
    for (const r of results.slice(0, 60)) {
        console.log(`  SpotAnim ${r.id}: model=${r.model}, seq=${r.seq}, unk2e=${r.unk2e}, scaleX=${r.scaleX}, scaleY=${r.scaleY}`);
    }
    if (results.length > 60) {
        console.log(`  ... and ${results.length - 60} more.`);
    }

    // ---------------------------------------------------------------
    // PASS 3: Also print low-ID SpotAnims to spot any golden beam candidates
    // ---------------------------------------------------------------
    console.log(`\n\n=== PASS 3: SpotAnims ID ${PROBE_RANGE_START}–${PROBE_RANGE_END} (context scan) ===`);
    for (const file of spotIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const entry of arch) {
                if (entry.fileid < PROBE_RANGE_START || entry.fileid > PROBE_RANGE_END) continue;
                try {
                    const sa = parse.spotAnims.read(entry.buffer, source);
                    console.log(`  SpotAnim ${entry.fileid}: model=${sa.model}, seq=${sa.sequence}, unk2e=${!!sa.unk2e}, scaleX=${sa.scaleX}`);
                } catch(e) {}
            }
        } catch(e) {}
    }
}

run().catch(console.error);
