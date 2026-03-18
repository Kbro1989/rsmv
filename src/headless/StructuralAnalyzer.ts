import * as fs from 'fs';
import type { PedagogyProfile } from './pedagogy_types.ts';

/**
 * StructuralAnalyzer — Distills professional production norms from exported assets.
 */
/**
 * StructuralAnalyzer — Distills professional production norms from exported assets.
 * Performs low-level GLB parsing to extract exact 3D metrics.
 */
export class StructuralAnalyzer {
    
    /**
     * Analyze a GLB file and extract production metrics.
     */
    public static async analyze(
        id: string, 
        name: string, 
        assetPath: string, 
        wikiData: any,
        cacheSemantic?: any
    ): Promise<PedagogyProfile> {
        console.log(`[StructuralAnalyzer] Analyzing: ${id}`);

        const isGlb = assetPath.endsWith('.glb');
        const buffer = await fs.promises.readFile(assetPath);
        
        let gltf: any = {};
        if (isGlb) {
            // 1. Extract JSON chunk from GLB
            const magic = buffer.toString('utf8', 0, 4);
            if (magic !== 'glTF') throw new Error(`Invalid GLB Magic: ${magic}`);
            
            const jsonChunkLength = buffer.readUInt32LE(12);
            const jsonChunkType = buffer.toString('utf8', 16, 20);
            if (jsonChunkType !== 'JSON') throw new Error(`Expected JSON chunk, got: ${jsonChunkType}`);
            
            let jsonString = buffer.toString('utf8', 20, 20 + jsonChunkLength);
            jsonString = jsonString.replace(/\0| +$/g, '');
            gltf = JSON.parse(jsonString);
        }

        // 2. Perform Detailed Structural Analysis
        const polyCount = isGlb ? this.calculatePolyCount(gltf) : 0;
        const boneCount = isGlb ? this.calculateBoneCount(gltf) : 0;
        const nodeCount = isGlb ? (gltf.nodes?.length || 0) : 0;
        const jointCount = isGlb ? this.calculateJointCount(gltf) : 0;
        
        const materialDetails = isGlb ? this.extractMaterials(gltf) : [];
        const dimensions = isGlb ? this.calculateDimensions(gltf) : { x: 0, y: 0, z: 0 };
        const assetType = id.startsWith('npc') ? 'NPC' : (id.startsWith('loc') ? 'OBJECT' : (id.startsWith('map') ? 'OBJECT' : 'ITEM'));

        return {
            id,
            name: cacheSemantic?.name || name,
            type: assetType as any,
            metrics: {
                polyCount,
                boneCount,
                nodeCount,
                jointCount,
                materialComplexity: materialDetails.length,
                rigLogic: boneCount > 0 ? 'SKELETAL' : 'STATIC',
                surfaceArea: Math.round(buffer.length / 1024),
                dimensions
            },
            structure: {
                meshCount: isGlb ? (gltf.meshes?.length || 0) : 0,
                animationCount: isGlb ? (gltf.animations?.length || 0) : 0,
                nodeHierarchyDepth: isGlb ? this.calculateHierarchyDepth(gltf) : 0,
                bones: isGlb ? this.extractBoneNames(gltf) : [],
                materials: materialDetails
            },
            semantic: {
                name: cacheSemantic?.name,
                actions: cacheSemantic?.actions,
                examine: wikiData?.examine // Placeholder for examine
            },
            semantics: {
                role: wikiData.role || (id.includes(':') ? id.split(':')[0] : 'Production Asset'),
                race: wikiData.race,
                intent: wikiData.intent || (nodeCount > 100 ? 'High-fidelity cinematic model' : 'Standard proxy model'),
                wikiUrl: wikiData.url
            },
            timestamp: Date.now()
        };
    }

    private static calculatePolyCount(gltf: any): number {
        let total = 0;
        if (!gltf.meshes) return 0;
        for (const mesh of gltf.meshes) {
            for (const prim of mesh.primitives) {
                if (prim.indices !== undefined) {
                    const accessor = gltf.accessors[prim.indices];
                    total += accessor.count / 3;
                } else if (prim.attributes.POSITION !== undefined) {
                    const posAccessor = gltf.accessors[prim.attributes.POSITION];
                    total += posAccessor.count / 3;
                }
            }
        }
        return Math.floor(total);
    }

    private static calculateBoneCount(gltf: any): number {
        // Count skeletal bones specifically marked or in skins
        if (!gltf.skins) return 0;
        let total = 0;
        for (const skin of gltf.skins) {
            total = Math.max(total, skin.joints.length);
        }
        return total;
    }

    private static calculateJointCount(gltf: any): number {
        if (!gltf.skins) return 0;
        const uniqueJoints = new Set();
        for (const skin of gltf.skins) {
            for (const jointIndex of skin.joints) {
                uniqueJoints.add(jointIndex);
            }
        }
        return uniqueJoints.size;
    }

    private static extractBoneNames(gltf: any): string[] {
        if (!gltf.nodes) return [];
        return gltf.nodes
            .filter((n: any) => n.name && (n.name.startsWith('bone_') || n.name.startsWith('root_')))
            .map((n: any) => n.name);
    }

    private static extractMaterials(gltf: any): { name: string, type: string }[] {
        if (!gltf.materials) return [];
        return gltf.materials.map((m: any) => ({
            name: m.name || 'unnamed',
            type: m.pbrMetallicRoughness ? 'PBR' : 'Legacy'
        }));
    }

    private static calculateHierarchyDepth(gltf: any): number {
        if (!gltf.nodes) return 0;
        const childrenMap = new Map<number, number[]>();
        const isChild = new Set<number>();
        
        gltf.nodes.forEach((node: any, idx: number) => {
            if (node.children) {
                childrenMap.set(idx, node.children);
                node.children.forEach((c: number) => isChild.add(c));
            }
        });

        const findDepth = (idx: number): number => {
            const children = childrenMap.get(idx);
            if (!children || children.length === 0) return 1;
            return 1 + Math.max(...children.map(findDepth));
        };

        let maxDepth = 0;
        const roots = gltf.nodes.map((_: any, idx: number) => idx).filter((idx: number) => !isChild.has(idx));
        if (roots.length === 0 && gltf.nodes.length > 0) return 1; // Cylindrical/Looped?
        
        roots.forEach((idx: number) => {
            maxDepth = Math.max(maxDepth, findDepth(idx));
        });

        return maxDepth;
    }

    private static calculateDimensions(gltf: any): { x: number, y: number, z: number } {
        let min = [Infinity, Infinity, Infinity];
        let max = [-Infinity, -Infinity, -Infinity];

        if (!gltf.accessors || !gltf.meshes) return { x: 0, y: 0, z: 0 };

        for (const mesh of gltf.meshes) {
            for (const prim of mesh.primitives) {
                const posIdx = prim.attributes.POSITION;
                const accessor = gltf.accessors[posIdx];
                if (accessor.min && accessor.max) {
                    for (let i = 0; i < 3; i++) {
                        min[i] = Math.min(min[i], accessor.min[i]);
                        max[i] = Math.max(max[i], accessor.max[i]);
                    }
                }
            }
        }

        return {
            x: Number((max[0] - min[0]).toFixed(3)),
            y: Number((max[1] - min[1]).toFixed(3)),
            z: Number((max[2] - min[2]).toFixed(3))
        };
    }
}
