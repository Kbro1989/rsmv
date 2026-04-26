import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors } from '../constants';
import { parse } from '../opdecoder';

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";
const OUT_DIR = "D:\\sovereign\\atlas\\skinning";

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function probeSkinning(modelId: number, outFile: string) {
    console.log(`🦴 Probing Model Extract ${modelId} for Skinning Vectors...`);
    const cache = new GameCacheLoader(CACHE_DIR);

    try {
        const rawModel = await cache.getFile(cacheMajors.models, modelId);
        if (rawModel) {
            const geom = (parse as any).models.read(rawModel, cache);
            
            const mesh = geom.meshdata || geom;
            console.log(`[+] Model ${modelId} Extracted Successfully.`);
            console.log(`  - Sub-Mesh Count: ${geom.meshCount || 1}`);
            
            const result: any = {
                modelId,
                totalMeshes: geom.meshCount || 1,
                meshes: []
            };

            const meshRes = {
                meshIndex: 0,
                vertexCount: mesh.vertexCount,
                hasBoneIds: mesh.hasBoneIds,
                hasSkin: mesh.hasSkin,
                boneidBuffer: mesh.boneidBuffer ? mesh.boneidBuffer.length : 0,
                skin: mesh.skin ? {
                    weightCount: mesh.skin.skinWeightCount,
                    boneBufferSample: mesh.skin.skinBoneBuffer ? Array.from(mesh.skin.skinBoneBuffer).slice(0, 10) : [],
                    weightsSample: mesh.skin.weights ? Array.from(mesh.skin.weights).slice(0, 5) : [] 
                } : null
            };
            result.meshes.push(meshRes);

            if (mesh.hasSkin && mesh.skin) {
                console.log(`    ✅ [Skinning Validated] Found ${mesh.skin.skinWeightCount} mapped skin assignments.`);
                const palette = new Set(Array.from(mesh.skin.skinBoneBuffer as number[] || []));
                console.log(`    ✅ Palette Bones: [${Array.from(palette).join(", ")}]`);
            }

            writeFileSync(`${OUT_DIR}/${outFile}`, JSON.stringify(result, null, 2));
            console.log(`\n✅ Extraction saved to ${OUT_DIR}/${outFile}`);

        } else {
            console.log(`Model payload not found or unparseable`);
        }
    } catch (e) {
        console.error("Probing failed:", e);
    } finally {
        cache.close();
    }
}

// Extract Hans's Torso model
probeSkinning(40820, "hans_torso.json");


