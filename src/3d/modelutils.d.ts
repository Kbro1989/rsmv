import { BufferAttribute, InterleavedBufferAttribute } from "three";
import { ModelData } from "./rt7model";
import type * as THREE from "three";
type rgb = [r: number, g: number, b: number];
type xyz = [x: number, y: number, z: number];
export declare class MeshBuilder {
    pos: number[];
    color: number[];
    uvs: number[];
    index: number[];
    normals: number[];
    vertindex: number;
    parent: ModelBuilder | null;
    constructor(parent: ModelBuilder | null);
    addParallelogram(col: rgb, v0: xyz, v1: xyz, v2: xyz): this;
    addTriangle(col: rgb, v0: xyz, v1: xyz, v2: xyz): this;
    addCube(col: rgb, [centerx, centery, centerz]: xyz, [sizex, sizey, sizez]: xyz): this;
    addExtrusion(color: rgb, vector: xyz, points: xyz[]): this;
    convertSubmesh(matid: number): ModelData["meshes"][number];
    mat(mat: number): MeshBuilder;
    convert(): ModelData;
}
export declare function getAttributeBackingStore(attr: BufferAttribute | InterleavedBufferAttribute): [data: ArrayBufferView, offset: number, stride: number];
export declare function computePartialNormals(index: THREE.BufferAttribute, positionAttribute: THREE.BufferAttribute, normalAttribute: THREE.BufferAttribute, indexstart: number, indexend: number): void;
export declare class ModelBuilder {
    meshes: Map<number, MeshBuilder>;
    mat(mat: number): MeshBuilder;
    convert(): ModelData;
}
export declare const materialPreviewCube: ModelData;
export declare const classicWall: ModelData;
export declare const classicWallDiag: ModelData;
export declare const classicRoof10: ModelData;
export declare const classicRoof12: ModelData;
export declare const classicRoof13: ModelData;
export declare const classicRoof14: ModelData;
export declare const classicRoof15: ModelData;
export declare const classicRoof16: ModelData;
export declare const classicRoof17: ModelData;
export declare const topdown2dWallModels: {
    wall: ModelData;
    shortcorner: ModelData;
    longcorner: ModelData;
    pillar: ModelData;
    diagonal: ModelData;
};
export {};
