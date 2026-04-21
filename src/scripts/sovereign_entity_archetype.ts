import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors, cacheConfigPages } from '../constants';
import { parse } from '../opdecoder';
import * as fs from 'fs';

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const OUT_DIR = "D:\\Users\\POG2\\Desktop\\pog-vibe-interactive\\files\\public";

async function extractSovereignEntity(npcId: number) {
    console.log(`\n🧬 ═══ Sovereign Entity Archetype Extraction: NPC ${npcId} ═══`);
    const cache = new GameCacheLoader(CACHE_DIR);

    // ═══ STEP 1: NPC Definition ═══
    console.log("\n[1/5] NPC Definition...");
    const npcIndex = await cache.getCacheIndex(cacheMajors.npcs);
    const npcArchId = Math.floor(npcId / 128);
    const npcFileId = npcId % 128;
    const npcArch = await cache.getFileArchive(npcIndex[npcArchId]);
    const npcFile = npcArch.find(f => f.fileid === npcFileId);
    const def = npcFile ? (parse as any).npc.read(npcFile.buffer, cache) : null;

    if (!def) { console.error("NPC not found!"); cache.close(); return; }

    console.log(`  Name: ${def.name}`);
    console.log(`  Models: [${def.models?.join(', ')}]`);
    console.log(`  HeadModels: [${def.headModels?.join(', ')}]`);
    console.log(`  AnimGroup: ${def.animation_group}`);
    console.log(`  Actions: ${[def.actions_0, def.actions_1, def.actions_2, def.actions_3, def.actions_4].filter(Boolean).join(', ')}`);

    // ═══ STEP 2: Animation Group → Sequences ═══
    console.log("\n[2/5] Animation Group Resolution...");
    const configIndex = await cache.getCacheIndex(cacheMajors.config);
    const animGroupArchInfo = configIndex[cacheConfigPages.animgroups];
    let animGroup: any = null;

    if (animGroupArchInfo) {
        const arch = await cache.getFileArchive(animGroupArchInfo);
        const file = arch.find(f => f.fileid === def.animation_group);
        if (file) {
            animGroup = (parse as any).animgroupConfigs.read(file.buffer, cache);
            console.log(`  AnimGroup ${def.animation_group}:`, JSON.stringify(animGroup));
        }
    }

    // Collect all sequence IDs
    const seqIds = new Set<number>();
    if (animGroup?.baseAnims) {
        Object.values(animGroup.baseAnims).forEach((v: any) => seqIds.add(v));
    }
    if (animGroup?.run) seqIds.add(animGroup.run);
    for (const key of Object.keys(animGroup || {})) {
        if (key.startsWith('unknown_') && typeof animGroup[key] === 'number') {
            seqIds.add(animGroup[key]);
        }
    }

    // ═══ STEP 3: Sequence Decoding ═══
    console.log("\n[3/5] Sequence Decoding...");
    const seqIndex = await cache.getCacheIndex(cacheMajors.sequences);
    const sequences: Record<number, any> = {};

    for (const seqId of seqIds) {
        const archId = Math.floor(seqId / 128);
        const fileId = seqId % 128;
        try {
            const arch = await cache.getFileArchive(seqIndex[archId]);
            const file = arch.find(f => f.fileid === fileId);
            if (file) {
                const seq = (parse as any).sequences.read(file.buffer, cache);
                sequences[seqId] = {
                    frameCount: seq.frames?.length || 0,
                    totalTicks: seq.frames?.reduce((s: number, f: any) => s + f.framelength, 0) || 0,
                    durationMs: (seq.frames?.reduce((s: number, f: any) => s + f.framelength, 0) || 0) * 20,
                    frameArchive: seq.frames?.[0]?.frameidhi || -1
                };
                console.log(`  Seq ${seqId}: ${sequences[seqId].frameCount}f, ${sequences[seqId].durationMs}ms, archive=${sequences[seqId].frameArchive}`);
            }
        } catch (e) { }
    }

    // ═══ STEP 4: Geometry + Bone Binding ═══
    console.log("\n[4/5] Geometry & Bone Extraction...");
    const bodyModels: any[] = [];
    const allBoneIds = new Set<number>();

    for (const mid of (def.models || [])) {
        try {
            const raw = await cache.getFile(cacheMajors.models, mid);
            const geom = (parse as any).models.read(raw, cache);
            const m = geom.meshdata || geom;
            const boneBuf = m.boneidBuffer ? Array.from(m.boneidBuffer) : [];
            const uniqueBones = [...new Set(boneBuf)].sort((a: any, b: any) => a - b);
            uniqueBones.forEach((b: any) => allBoneIds.add(b));

            bodyModels.push({
                modelId: mid,
                vertexCount: m.vertexCount || 0,
                faceCount: m.faceCount || 0,
                boneIds: uniqueBones,
                hasSkin: m.hasSkin || 0,
                hasNormals: !!m.normalBuffer,
                hasUV: !!m.uvBuffer
            });
            console.log(`  Model ${mid}: ${m.vertexCount || 0} verts, ${uniqueBones.length} bones [${uniqueBones.slice(0, 6).join(',')}${uniqueBones.length > 6 ? '...' : ''}]`);
        } catch (e) {
            console.log(`  Model ${mid}: FAILED (${(e as Error).message})`);
        }
    }

    // ═══ STEP 5: Framemap Skeleton ═══
    console.log("\n[5/5] Skeleton Resolution...");
    const firstSeq = Object.values(sequences)[0] as any;
    let skeletonBoneCount = 0;
    let framemapId = -1;

    if (firstSeq?.frameArchive > 0) {
        const frIndex = await cache.getCacheIndex(cacheMajors.frames);
        if (frIndex[firstSeq.frameArchive]) {
            const frArch = await cache.getFileArchive(frIndex[firstSeq.frameArchive]);
            if (frArch.length > 0) {
                const frame = (parse as any).frames.read(frArch[0].buffer, cache);
                framemapId = frame.probably_framemap_id;
                console.log(`  Frame archive ${firstSeq.frameArchive} → framemap ${framemapId}`);

                // Extract framemap skeleton
                const fmIndex = await cache.getCacheIndex(cacheMajors.framemaps);
                if (fmIndex[framemapId]) {
                    const fmArch = await cache.getFileArchive(fmIndex[framemapId]);
                    for (const file of fmArch) {
                        try {
                            const fm = (parse as any).framemaps.read(file.buffer, cache);
                            if (fm.skeleton?.length > 0) {
                                skeletonBoneCount = fm.skeleton.length;
                                console.log(`  Framemap ${framemapId}: ${skeletonBoneCount} bones`);
                            }
                        } catch (e) { }
                    }
                }
            }
        }
    }

    // ═══ OUTPUT: Sovereign Entity Profile ═══
    const sortedDeformBones = [...allBoneIds].sort((a, b) => a - b);
    const totalVertices = bodyModels.reduce((s, m) => s + m.vertexCount, 0);

    const output = {
        entity: {
            npcId,
            name: def.name,
            actions: [def.actions_0, def.actions_1, def.actions_2, def.actions_3, def.actions_4].filter(Boolean),
            boundSize: def.boundSize || 1,
            combat: def.combat || 0,
            movementCapabilities: def.movementCapabilities
        },
        geometry: {
            bodyModels,
            headModels: def.headModels || [],
            totalVertices,
            totalMeshes: bodyModels.length,
            totalUniqueBones: sortedDeformBones.length,
            colorReplacements: def.color_replacements?.length || 0,
            materialReplacements: def.material_replacements?.length || 0
        },
        skeleton: {
            framemapId,
            totalBones: skeletonBoneCount,
            deformBones: sortedDeformBones,
            attachmentNodes: skeletonBoneCount - sortedDeformBones.length,
            skinningType: bodyModels.some(m => m.hasSkin) ? 'nxt_weighted' : 'legacy_single_bone_per_vertex'
        },
        kinematics: {
            animationGroup: def.animation_group,
            sequences: Object.entries(sequences).map(([id, seq]: any) => ({
                id: Number(id),
                frameCount: seq.frameCount,
                totalTicks: seq.totalTicks,
                durationMs: seq.durationMs,
                frameArchive: seq.frameArchive
            }))
        },
        extractionTimestamp: new Date().toISOString()
    };

    const filename = `sovereign_entity_${def.name?.toLowerCase().replace(/\s+/g, '_') || npcId}.json`;
    fs.writeFileSync(`${OUT_DIR}/${filename}`, JSON.stringify(output, null, 2));

    console.log(`\n✅ ═══ Sovereign Entity Profile: ${def.name} ═══`);
    console.log(`  Meshes: ${bodyModels.length} | Vertices: ${totalVertices} | Deform Bones: ${sortedDeformBones.length}`);
    console.log(`  Skeleton: ${skeletonBoneCount} total (${skeletonBoneCount - sortedDeformBones.length} attachment nodes)`);
    console.log(`  Sequences: ${Object.keys(sequences).length}`);
    console.log(`  Saved: ${OUT_DIR}/${filename}`);

    cache.close();
    return output;
}

// Execute Cyrisus polymorphic chain
(async () => {
    await extractSovereignEntity(435);  // Fallen Man (unconscious)
    await extractSovereignEntity(432);  // Cyrisus Melee Combat
    await extractSovereignEntity(30322); // Spirit of Um
})();

