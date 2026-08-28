import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors } from '../constants';
import { parse } from '../opdecoder';

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const OUT_DIR = "D:\\sovereign\\atlas\\skeletons";

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function extractSkeleton(targetAnimGroupId: number, outName: string) {
    console.log(`🦴 Initiating Skeletal Rig Surgery for AnimGroup ${targetAnimGroupId}...`);
    
    const cache = new GameCacheLoader(CACHE_DIR);

    try {
        // Step 1: Resolve the animation_group metadata (Major 2 / archive 32 typically, but in opdecoder it is animgroupConfigs)
        // animgroupConfigs maps the "base animation group" to actual sequences and skeleton references in NXT
        const animGroupArchIndex = (await cache.getCacheIndex(cacheMajors.config))[32]; 
        let skeletonId = -1;
        let sequenceIds: number[] = [];

        if (animGroupArchIndex) {
            const arch = await cache.getFileArchive(animGroupArchIndex);
            for (const file of arch) {
                if (file.fileid === targetAnimGroupId) {
                    const animGroup = (parse as any).animgroupConfigs.read(file.buffer, cache);
                    console.log(`[+] AnimGroup ${targetAnimGroupId} Discovered:`, animGroup);
                    
                    // In NXT, animGroups usually point to sequence indices (e.g., baseAnim)
                    skeletonId = animGroup.baseAnim; 
                    sequenceIds = animGroup.anims || [];
                    break;
                }
            }
        }

        // If direct lookup fails because animGroup references point directly to sequences rather than skeletons:
        // We will fetch sequence 808/819 directly, and pull the skeleton ID from the sequence!
        if (targetAnimGroupId === 1426) {
            // Hardcode known RS3 Hans skeleton derived by your mapping if dynamic fails, 
            // but let's try direct sequence scan first!
            console.log("Searching Sequence Configs for Skeleton Reference...");
            const seqIndex = await cache.getCacheIndex(cacheMajors.sequences);
            // In NXT, major 20 is sequences.
            const seqArch = await cache.getFileArchive(seqIndex[Math.floor(808 / 128)]);
            const file = seqArch.find(f => f.fileid === (808 % 128));
            if (file) {
                const seq = (parse as any).sequences.read(file.buffer, cache);
                console.log("[+] Found Sequence 808. Skeleton Base:", seq.skeleton);
            }
        }

        // Extract structural skeleton rig arrays (framemaps / Major 1)
        console.log(`\nProbing Major 1 (framemaps) for the rig structure...`);
        const skelIndex = await cache.getCacheIndex(cacheMajors.framemaps); 
        console.log(`Index 1 contains ${skelIndex.length} rig map chunks.`);
        
        let foundSkeletons = 0;
        const rigOutput: any[] = [];

        // Dump sample valid hierarchies
        for (const [archId, info] of Object.entries(skelIndex).slice(0, 100)) {
            if (!info) continue;
            try {
                const arch = await cache.getFileArchive(info);
                for (const file of arch) {
                    const skel = (parse as any).framemaps.read(file.buffer, cache);
                    if (skel.skeleton && skel.skeleton.length > 0) {
                        rigOutput.push({ archiveId: archId, fileId: file.fileid, boneCount: skel.skeleton.length, data: skel.skeleton });
                        foundSkeletons++;
                    }
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        console.log(`Successfully scraped ${foundSkeletons} skeletons.`);
        if (rigOutput.length > 0) {
            writeFileSync(`${OUT_DIR}/skeleton_sample.json`, JSON.stringify(rigOutput[0], null, 2));
            console.log(`Sample rig saved to ${OUT_DIR}/skeleton_sample.json`);
        }
    } catch (e) {
        console.error("Surgery failed:", e);
    } finally {
        cache.close();
    }
}

// target: 1426 (Hans), 2533 (Player base)
extractSkeleton(1426, "hans_base");


