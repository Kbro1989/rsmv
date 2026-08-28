import * as THREE from "three";
import { CacheFileSource } from "../cache";
export type BoneCenter = {
    xsum: number;
    ysum: number;
    zsum: number;
    weightsum: number;
};
export type ModelData = {
    maxy: number;
    miny: number;
    skincount: number;
    bonecount: number;
    meshes: ModelMeshData[];
    debugmeshes?: THREE.Mesh[];
};
export type ModelMeshData = {
    indices: THREE.BufferAttribute;
    vertexstart: number;
    vertexend: number;
    indexLODs: THREE.BufferAttribute[];
    materialId: number;
    hasVertexAlpha: boolean;
    needsNormalBlending: boolean;
    attributes: {
        pos: THREE.BufferAttribute;
        normals?: THREE.BufferAttribute;
        color?: THREE.BufferAttribute;
        texuvs?: THREE.BufferAttribute;
        skinids?: THREE.BufferAttribute;
        skinweights?: THREE.BufferAttribute;
        boneids?: THREE.BufferAttribute;
        boneweights?: THREE.BufferAttribute;
    };
};
export declare function getBoneCenters(model: ModelData): BoneCenter[];
export declare function getModelCenter(model: ModelData): BoneCenter;
export declare function parseOb3Model(modelfile: Buffer, source: CacheFileSource): ModelData;
export declare function makeModelData(meshes: ModelData["meshes"]): ModelData;
