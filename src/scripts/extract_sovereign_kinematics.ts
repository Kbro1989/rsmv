import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors } from '../constants';
import { parse } from '../opdecoder';
import * as fs from 'fs';

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";
const OUT_DIR = "D:\\sovereign\\atlas\\kinematics";

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

interface FrameEntry {
    frameIndex: number;
    framelength: number; // ticks (each tick = 20ms in RS3)
    frameidlow: number;
    frameidhi: number;  // framemap archive ID
}

async function extractKinematics() {
    console.log("🦴 Sovereign Kinematic Pipeline Extraction");
    const cache = new GameCacheLoader(CACHE_DIR);

    // === Step 1: Extract NPC 0 (Hans) definition ===
    console.log("\n== Step 1: NPC Definition ==");
    const npcIndex = await cache.getCacheIndex(cacheMajors.npcs);
    const npcArchId = Math.floor(0 / 128);  // NPC 0
    const npcArch = await cache.getFileArchive(npcIndex[npcArchId]);
    const npcFile = npcArch.find(f => f.fileid === 0);
    const hansDef = npcFile ? parse.npc.read(npcFile.buffer, cache) : null;
    console.log("Hans NPC Definition:", JSON.stringify(hansDef, null, 2));

    // === Step 2: Extract Sequence 808 (idle) and 819 (walk) ===
    console.log("\n== Step 2: Sequence Definitions ==");
    const seqIndex = await cache.getCacheIndex(cacheMajors.sequences);

    const sequences: Record<string, any> = {};
    for (const seqId of [808, 819, 820, 821, 822, 823, 824]) {
        const archId = Math.floor(seqId / 128);
        const fileId = seqId % 128;
        try {
            const arch = await cache.getFileArchive(seqIndex[archId]);
            const file = arch.find(f => f.fileid === fileId);
            if (file) {
                const seq = parse.sequences.read(file.buffer, cache);
                sequences[seqId] = {
                    frameCount: seq.frames?.length || 0,
                    totalTicks: seq.frames?.reduce((s: number, f: any) => s + f.framelength, 0) || 0,
                    framemapArchive: seq.frames?.[0]?.frameidhi || -1,
                    frames: seq.frames
                };
                console.log(`  Seq ${seqId}: ${sequences[seqId].frameCount} frames, ${sequences[seqId].totalTicks} ticks, framemap=${sequences[seqId].framemapArchive}`);
            }
        } catch (e) { }
    }

    // === Step 3: Extract actual keyframe data from Major 48 (frames) ===
    console.log("\n== Step 3: Keyframe Extraction ==");
    const frIndex = await cache.getCacheIndex(cacheMajors.frames);

    // Get the framemap archive from sequence 808 (idle)
    const idleFramemapArchive = sequences[808]?.framemapArchive;
    if (idleFramemapArchive && frIndex[idleFramemapArchive]) {
        const frArch = await cache.getFileArchive(frIndex[idleFramemapArchive]);
        console.log(`  Frame archive ${idleFramemapArchive}: ${frArch.length} frame files`);

        // Extract first frame to inspect structure
        const firstFrame = parse.frames.read(frArch[0].buffer, cache);
        console.log(`  Frame 0 framemap ref: ${firstFrame.probably_framemap_id}`);
        console.log(`  Frame 0 animdata length: ${firstFrame.animdata?.length || 0}`);
        console.log(`  Frame 0 flags length: ${firstFrame.flags?.length || 0}`);
    }

    // === Step 4: Extract framemap skeleton from the ID referenced by frames ===
    console.log("\n== Step 4: Skeleton Extraction via Framemap ==");
    const fmIndex = await cache.getCacheIndex(cacheMajors.framemaps);

    // The frame references framemap 0, so get the skeleton from framemap archive 0
    const fmArch = await cache.getFileArchive(fmIndex[0]);
    for (const file of fmArch) {
        try {
            const fm = parse.framemaps.read(file.buffer, cache);
            if (fm.skeleton && fm.skeleton.length > 0) {
                console.log(`  Framemap 0 file ${file.fileid}: ${fm.skeleton.length} bones, ${fm.data?.length || 0} data entries`);

                // Count unique bone IDs referenced
                const boneIds = new Set(fm.skeleton.map((b: any) => b.nonskinboneid));
                console.log(`  Unique nonskinboneid refs: ${boneIds.size}`);
            }
        } catch (e) { }
    }

    // === Step 5: Composite Output ===
    console.log("\n== Step 5: Writing Composite Output ==");
    const output = {
        npc: {
            id: 0,
            name: (hansDef as any)?.name || "Hans",
            models: (hansDef as any)?.models || [],
            headModels: (hansDef as any)?.headModels || [],
            animation_group: 1426,
            standanim: (hansDef as any)?.standanim,
            walkanim: (hansDef as any)?.walkanim,
            readyanim: (hansDef as any)?.readyanim
        },
        sequences,
        framemapArchive: idleFramemapArchive,
        skeletonBoneCount: 206, // from our framemap 0 extraction
        extractionTimestamp: new Date().toISOString()
    };

    fs.writeFileSync(`${OUT_DIR}/hans_kinematic_profile.json`, JSON.stringify(output, null, 2));
    console.log(`\n✅ Full kinematic profile saved to ${OUT_DIR}/hans_kinematic_profile.json`);

    cache.close();
}

extractKinematics().catch(console.error);
