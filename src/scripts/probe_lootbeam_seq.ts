/**
 * probe_lootbeam_seq.ts
 * 
 * Decode sequence 32632 (golden beam) to extract:
 * - Frame durations (looping animation)
 * - Frame archive ID (frameidhi)
 * 
 * Also search for nearby spotAnims that might be the 4-tier variants
 * (game typically uses multiple SpotAnims per beam variant for T1/T2/T3/T4 sizing)
 */
import { GameCacheLoader } from "../cache/sqlite.js";
import { parse } from "../opdecoder.js";
import { cacheMajors } from "../constants.js";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function run() {
    const source = new GameCacheLoader(CACHE_DIR);

    // Decode sequence 32632 (golden beam animation)
    console.log("=== Sequence 32632 (Golden Loot Beam) ===");
    const seqIndex = await source.getCacheIndex(cacheMajors.sequences);
    for (const file of seqIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const entry of arch) {
                if (entry.fileid === 32632) {
                    const seq = parse.sequences.read(entry.buffer, source);
                    console.log(JSON.stringify(seq, null, 2));
                }
                // Also check 32633, 32634, 32635 (potential tier variants)
                if ([32632, 32633, 32634, 32635, 32636, 32637].includes(entry.fileid)) {
                    const seq = parse.sequences.read(entry.buffer, source);
                    console.log(`\nSeq ${entry.fileid}: frameidhi=${seq.frames?.[0]?.frameidhi}, framecount=${seq.frames?.length}`);
                }
            }
        } catch(e) {}
    }

    // Scan SpotAnims 35-60 to find all 4 beam tier variants
    console.log("\n=== SpotAnims 35–60 (Beam Tier Candidates) ===");
    const spotIndex = await source.getCacheIndex(cacheMajors.spotanims);
    for (const file of spotIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const entry of arch) {
                if (entry.fileid < 35 || entry.fileid > 80) continue;
                try {
                    const sa = parse.spotAnims.read(entry.buffer, source);
                    console.log(`  SpotAnim ${entry.fileid}: model=${sa.model} seq=${sa.sequence} scaleX=${sa.scaleX ?? 'def'} scaleY=${sa.scaleYorZ ?? 'def'} unk2e=${!!sa.unk2e} replaceColors=${sa.replace_colors?.length ?? 0}`);
                } catch(e) {
                    console.log(`  SpotAnim ${entry.fileid}: parse error`);
                }
            }
        } catch(e) {}
    }

    // Also decode the model 74984 and 74985 to see if they have color tables
    // (beam variants use color replacement for their tier/theme colors)
    console.log("\n=== Models 74984–74985 (Beam Geometry) ===");
    const modelIndex = await source.getCacheIndex(cacheMajors.models);
    for (const file of modelIndex) {
        try {
            const arch = await source.getFileArchive(file);
            for (const entry of arch) {
                if (entry.fileid !== 74984 && entry.fileid !== 74985) continue;
                try {
                    const m = parse.models.read(entry.buffer, source);
                    const firstMesh = m.meshes?.[0] || m.meshdata;
                    console.log(`\nModel ${entry.fileid}:`);
                    console.log(`  faceColors: ${firstMesh?.faceCount ?? 0} faces`);
                    console.log(`  replace_colors: []`);
                    console.log(`  vertexCount: ${firstMesh?.vertexCount ?? '?'}`);
                } catch(e) {}
            }
        } catch(e) {}
    }
}

run().catch(console.error);
