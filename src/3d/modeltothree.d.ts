import { cacheMajors } from "../constants";
import { ParsedTexture } from "./textures";
import { ModelData } from '../3d/rt7model';
import { MaterialData } from "./jmat";
import * as THREE from "three";
import { CacheFileSource } from "../cache";
import { CachingFileSource } from "../cache/memorycache";
import { Mesh } from "three";
import { mapsquare_underlays } from "../../generated/mapsquare_underlays";
import { mapsquare_overlays } from "../../generated/mapsquare_overlays";
import { mapscenes } from "../../generated/mapscenes";
import { JSONSchema6Definition } from "json-schema";
import { models } from "../../generated/models";
import { LegacyData } from "../cache/legacycache";
import { ClassicConfig } from "../cache/classicloader";
import { maplabels } from "../../generated/maplabels";
export declare const constModelsIds: {
    materialCube: number;
    classicWall: number;
    classicWallDiag: number;
    classicRoof10: number;
    classicRoof12: number;
    classicRoof13: number;
    classicRoof14: number;
    classicRoof15: number;
    classicRoof16: number;
    classicRoof17: number;
};
export type ParsedMaterial = {
    mat: THREE.Material;
    matmeta: MaterialData;
};
export declare function augmentThreeJsMinimapLocMaterial(mat: THREE.Material): void;
export declare function augmentZOffsetMaterial(mat: THREE.Material, zoffset: number): void;
export declare function augmentThreeJsFloorMaterial(mat: THREE.Material, isminimap: boolean): void;
export declare class EngineCache extends CachingFileSource {
    hasOldModels: boolean;
    hasNewModels: boolean;
    materialArchive: Map<number, Buffer<ArrayBufferLike>>;
    materialCache: Map<number, MaterialData>;
    mapUnderlays: (mapsquare_underlays | mapsquare_overlays)[];
    mapOverlays: mapsquare_overlays[];
    mapMapscenes: mapscenes[];
    mapMaplabels: maplabels[];
    legacyData: LegacyData | null;
    classicData: ClassicConfig | null;
    private jsonSearchCache;
    private dependencyGraph;
    static create(source: CacheFileSource): Promise<EngineCache>;
    private constructor();
    private preload;
    getDependencyGraph(): Promise<{
        dependencyMap: Map<string, string[]>;
        dependentsMap: Map<string, string[]>;
        cascadeDependencies: (depname: string, list?: string[]) => string[];
        makeDeptName: (deptType: import("../scripts/dependencies").DepTypes, id: number) => string;
        hashDependencies: (depname: string, previouscrc?: number) => number;
        hasEntry: (deptType: import("../scripts/dependencies").DepTypes, depId: number) => boolean;
        insertMapChunk: (data: import("./mapsquare").ChunkData) => string;
        preloadChunkDependencies: (args?: {
            area?: import("./mapsquare").MapRect;
        } | undefined) => Promise<void>;
    }>;
    getGameFile(type: keyof LegacyData & keyof typeof cacheMajors, id: number): Promise<Buffer<ArrayBufferLike>>;
    getMaterialData(id: number): MaterialData;
    /**
     * very aggressive caching, do not use for objects which take a lot of memory
     */
    getJsonSearchData(modename: string): {
        files: Promise<any[]>;
        schema: JSONSchema6Definition;
    };
}
export declare function iterateConfigFiles(cache: EngineCache, major: number): AsyncGenerator<{
    id: number;
    file: Buffer<ArrayBufferLike>;
}, void, unknown>;
export declare function detectTextureMode(source: CacheFileSource): Promise<"none" | "dds" | "bmp" | "oldpng" | "png2014" | "dds2014" | "oldproc" | "fullproc" | "legacy" | "legacytga">;
type ModelModes = "nxt" | "old" | "classic";
type TextureModes = "png" | "dds" | "bmp" | "ktx" | "oldpng" | "png2014" | "dds2014" | "none" | "oldproc" | "fullproc" | "legacy" | "legacytga";
type TextureTypes = keyof MaterialData["textures"];
export declare class ThreejsSceneCache {
    private modelCache;
    private threejsTextureCache;
    private threejsMaterialCache;
    engine: EngineCache;
    textureType: TextureModes;
    modelType: ModelModes;
    static textureIndices: Record<TextureTypes, Record<Exclude<TextureModes, "none">, number>>;
    private constructor();
    static create(engine: EngineCache, texturemode?: TextureModes | "auto", modelmode?: ModelModes | "auto"): Promise<ThreejsSceneCache>;
    getTextureFile(type: TextureTypes, texid: number, stripAlpha: boolean): Promise<ParsedTexture>;
    getModelData(id: number): Promise<ModelData>;
    getMaterial(matid: number, hasVertexAlpha: boolean, minimapVariant: boolean): Promise<ParsedMaterial>;
}
export declare function applyMaterial(mesh: Mesh, parsedmat: ParsedMaterial, minimapVariant: boolean, inplace?: boolean): void;
/**
 * When merging player npc models the client incorrectly merge vertices which
 * have the same position+color+material, but with different bone ids. The second
 * vertex will be merged and its bone id is lost. This bug is so entrenched in
 * the game that player models will have detached arms and waist if not replicated
 */
export declare function mergeBoneids(model: ModelData): void;
export declare function mergeModelDatas(models: ModelData[]): ModelData;
export declare function ob3ModelToThree(scene: ThreejsSceneCache, model: ModelData): Promise<THREE.Object3D<THREE.Object3DEventMap>>;
export declare function getModelHashes(model: models, id: number): void;
export {};
