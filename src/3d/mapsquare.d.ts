import { ModelModifications } from "../utils";
import { mapsquare_underlays } from "../../generated/mapsquare_underlays";
import { mapsquare_overlays } from "../../generated/mapsquare_overlays";
import { mapsquare_locations } from "../../generated/mapsquare_locations";
import { ModelMeshData } from "./rt7model";
import { mapsquare_tiles } from "../../generated/mapsquare_tiles";
import { ThreejsSceneCache, EngineCache, ParsedMaterial } from "./modeltothree";
import { BufferAttribute, Matrix4, Object3D } from "three";
import { objects } from "../../generated/objects";
import * as THREE from "three";
import { CacheFileSource } from "../cache";
import { CanvasImage } from "../imgutils";
import { mapsquare_tiles_nxt } from "../../generated/mapsquare_tiles_nxt";
export declare const tiledimensions = 512;
export declare const rs2ChunkSize = 64;
export declare const classicChunkSize = 48;
export declare const squareLevels = 4;
export declare const worldStride = 128;
export declare const tileshapes: TileShape[], defaulttileshape: TileShape, defaulttileshapeflipped: TileShape;
export type MapRect = {
    x: number;
    z: number;
    xsize: number;
    zsize: number;
};
export declare function mapRectsIntersect(a: MapRect, b: MapRect): boolean;
export declare function mapRectContains(rect: MapRect, x: number, z: number): boolean;
type CollisionData = {
    settings: number;
    walk: boolean[];
    sight: boolean[];
};
type FloorvertexInfo = {
    subvertex: number;
    nextx: boolean;
    nextz: boolean;
    subx: number;
    subz: number;
};
type TileShape = {
    underlay: FloorvertexInfo[];
    overlay: FloorvertexInfo[];
};
export type TileVertex = {
    material: number;
    materialTiling: number;
    materialBleedpriority: number;
    color: number[];
};
export type ChunkData = {
    tilerect: MapRect;
    levelcount: number;
    mapsquarex: number;
    mapsquarez: number;
    chunkfilehash: number;
    chunkfileversion: number;
    tiles: mapsquare_tiles["tiles"];
    nxttiles: mapsquare_tiles_nxt | null;
    extra: mapsquare_tiles["extra"];
    rawlocs: mapsquare_locations["locations"];
    locs: WorldLocation[];
};
export type ClickableMesh<T> = {
    isclickable: true;
    searchPeers: boolean;
    subranges: number[];
    subobjects: T[];
};
export type ModelExtrasLocation = {
    modeltype: "location";
    isclickable: false;
    modelgroup: string;
    locationid: number;
    worldx: number;
    worldz: number;
    rotation: number;
    mirror: boolean;
    isGroundDecor: boolean;
    level: number;
    locationInstance: WorldLocation;
};
type ModelExtrasOverlay = {
    modeltype: "overlay";
    isclickable: false;
    modelgroup: string;
    level: number;
};
export type ModelExtras = ModelExtrasLocation | ModelExtrasOverlay | {
    modeltype: "floor" | "floorhidden";
    modelgroup: string;
    mapsquarex: number;
    mapsquarez: number;
    level: number;
} & ClickableMesh<MeshTileInfo> | {
    modeltype: "locationgroup";
    modelgroup: string;
} & ClickableMesh<ModelExtrasLocation | ModelExtrasOverlay>;
export type MeshTileInfo = {
    tile: mapsquare_tiles["tiles"][number] | null;
    tilenxt: unknown;
    x: number;
    z: number;
    level: number;
    underlaycolor: number[];
};
type NxtTileInfo = Exclude<mapsquare_tiles_nxt["level0"], null | undefined>[number];
export declare class TileProps {
    debug_nxttile: NxtTileInfo | null;
    debug_raw: mapsquare_tiles["tiles"][number] | null;
    rawOverlay: mapsquare_overlays | undefined;
    rawUnderlay: mapsquare_underlays | undefined;
    settings: number;
    next01: TileProps | undefined;
    next10: TileProps | undefined;
    next11: TileProps | undefined;
    x: number;
    y: number;
    z: number;
    y10: number;
    y01: number;
    y11: number;
    playery00: number;
    playery01: number;
    playery10: number;
    playery11: number;
    shape: TileShape;
    underlayVisible: boolean;
    overlayVisible: boolean;
    normalX: number;
    normalZ: number;
    bleedsOverlayMaterial: boolean;
    vertexprops: TileVertex[];
    overlayprops: TileVertex;
    underlayprops: TileVertex;
    originalUnderlayColor: number[];
    rawCollision: CollisionData | undefined;
    effectiveCollision: CollisionData | undefined;
    effectiveLevel: number;
    effectiveVisualLevel: number;
    waterProps: {
        y00: number;
        y01: number;
        y10: number;
        y11: number;
        props: TileVertex;
        shape: FloorvertexInfo[];
        isoriginal: boolean;
        rawOverlay: mapsquare_overlays;
    } | null;
    addUnderlay(engine: EngineCache, tileunderlay: number | undefined | null): void;
    addOverlay(engine: EngineCache, tileoverlay: number | undefined | null, shape: number | undefined | null): void;
    addUnderWater(engine: EngineCache, height: number, tileoverlay: number | undefined | null, tileunderlay: number | undefined | null): void;
    constructor(height: number, tilesettings: number, tilex: number, tilez: number, level: number, docollision: boolean);
}
type FloorMorph = {
    translate: THREE.Vector3;
    rotation: THREE.Quaternion;
    scale: THREE.Vector3;
    placementMode: "simple" | "followfloor" | "followfloorceiling";
    scaleModelHeightOffset: number;
    originx: number;
    originz: number;
    level: number;
};
export declare function modifyMesh(mesh: ModelMeshData, mods: ModelModifications): {
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
export declare function getMorphMatrix(morph: FloorMorph, gridoffsetx: number, gridoffsetz: number): Matrix4;
export declare function transformVertexPositions(pos: BufferAttribute, morph: FloorMorph, grid: TileGrid, modelheight: number, gridoffsetx: number, gridoffsetz: number, newpos?: THREE.BufferAttribute, newposindex?: number, inputstart?: number, inputend?: number): BufferAttribute;
export interface TileGridSource {
    getTile(x: number, z: number, level: number): TileProps | undefined;
}
export declare class CombinedTileGrid implements TileGridSource {
    grids: {
        src: TileGridSource;
        rect: MapRect;
    }[];
    constructor(grids: {
        src: TileGridSource;
        rect: MapRect;
    }[]);
    getTile(x: number, z: number, level: number): TileProps | undefined;
}
export declare function getTileHeight(grid: TileGridSource, x: number, z: number, level: number): number;
export declare class TileGrid implements TileGridSource {
    engine: EngineCache;
    area: MapRect;
    tilemask: undefined | MapRect[];
    xsize: number;
    zsize: number;
    levels: number;
    xoffset: number;
    zoffset: number;
    tiles: TileProps[];
    xstep: number;
    zstep: number;
    levelstep: number;
    constructor(engine: EngineCache, area: MapRect, tilemask?: MapRect[] | undefined);
    getHeightCollisionFile(x: number, z: number, level: number, xsize: number, zsize: number, allcorners: boolean): Uint16Array<ArrayBuffer>;
    getTile(x: number, z: number, level: number): TileProps | undefined;
    blendUnderlays(): void;
    gatherMaterials(x: number, z: number, xsize: number, zsize: number): Map<number, number>;
    addMapsquare(tiles: mapsquare_tiles["tiles"], nxttiles: mapsquare_tiles_nxt | null, chunkrect: MapRect, levels: number, docollision?: boolean): void;
}
export type ParsemapOpts = {
    padfloor?: boolean;
    invisibleLayers?: boolean;
    collision?: boolean;
    map2d?: boolean;
    minimap?: boolean;
    hashboxes?: boolean;
    skybox?: boolean;
    mask?: MapRect[];
};
export declare function getMapsquareData(engine: EngineCache, chunkx: number, chunkz: number): Promise<ChunkData | null>;
export declare function parseMapsquare(engine: EngineCache, chunkx: number, chunkz: number, opts?: ParsemapOpts): Promise<{
    grid: TileGrid;
    chunk: ChunkData | null;
    chunkSize: number;
    chunkx: number;
    chunkz: number;
}>;
export declare function mapsquareSkybox(scene: ThreejsSceneCache, mainchunk: ChunkData): Promise<{
    skybox: Object3D<THREE.Object3DEventMap>;
    fogColor: number[];
    skyboxModelid: number;
}>;
export declare function mapsquareFloors(scene: ThreejsSceneCache, grid: TileGrid, chunk: ChunkData, opts?: ParsemapOpts): Promise<{
    chunk: ChunkData;
    level: number;
    tileinfos: MeshTileInfo[];
    mode: ("default" | "wireframe" | "worldmap" | "minimap") | "walkmesh";
    iswater: boolean;
    vertexstride: number;
    indices: Uint32Array<ArrayBuffer>;
    nvertices: number;
    atlas: SimpleTexturePacker | null;
    pos: {
        src: ArrayBufferView;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    normal: {
        src: Float32Array<ArrayBuffer>;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    color: {
        src: Uint8Array<ArrayBuffer>;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    _RA_FLOORTEX_UV0: {
        src: Uint16Array<ArrayBuffer>;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    _RA_FLOORTEX_UV1: {
        src: Uint16Array<ArrayBuffer>;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    _RA_FLOORTEX_UV2: {
        src: Uint16Array<ArrayBuffer>;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    _RA_FLOORTEX_WEIGHTS: {
        src: Uint8Array<ArrayBuffer>;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    _RA_FLOORTEX_USESCOLOR: {
        src: Uint8Array<ArrayBuffer>;
        offset: number;
        vecsize: number;
        normalized: boolean;
    };
    posmax: number[];
    posmin: number[];
    extra: {
        modeltype: "floor" | "floorhidden";
        modelgroup: string;
        mapsquarex: number;
        mapsquarez: number;
        level: number;
    } & ClickableMesh<MeshTileInfo>;
}[]>;
export type ThreeJsRenderSection = {
    mesh: RSBatchMesh;
    startindex: number;
    endindex: number;
    startvertex: number;
    endvertex: number;
    hidden: boolean;
};
export type RSMapChunkData = {
    grid: TileGrid;
    chunk: ChunkData | null;
    chunkSize: number;
    sky: {
        skybox: Object3D;
        fogColor: number[];
        skyboxModelid: number;
    } | null;
    modeldata: Map<WorldLocation, PlacedMesh[]>;
    chunkroot: THREE.Group;
    chunkx: number;
    chunkz: number;
    locRenders: Map<WorldLocation, ThreeJsRenderSection[]>;
};
export declare function renderMapSquare(cache: ThreejsSceneCache, parsedsquare: ReturnType<typeof parseMapsquare>, chunkx: number, chunkz: number, opts: ParsemapOpts): Promise<RSMapChunkData>;
type SimpleTexturePackerAlloc = {
    u: number;
    v: number;
    usize: number;
    vsize: number;
    x: number;
    y: number;
    repeatWidth: number;
    repeatHeight: number;
    totalpixels: number;
    img: CanvasImage;
};
declare class SimpleTexturePacker {
    padsize: number;
    width: number;
    height: number;
    allocs: SimpleTexturePackerAlloc[];
    map: Map<number, SimpleTexturePackerAlloc>;
    allocx: number;
    allocy: number;
    allocLineHeight: number;
    result: HTMLCanvasElement | null;
    resultSource: THREE.Texture | null;
    constructor(width: number, height: number);
    addTexture(id: number, img: CanvasImage, repeat: number): boolean;
    convertToThreeTexture(): THREE.Texture;
    convert(): HTMLCanvasElement;
}
export type PlacedMeshBase<T> = {
    model: ModelMeshData;
    morph: FloorMorph;
    miny: number;
    maxy: number;
    extras: T;
};
export type PlacedMesh = PlacedMeshBase<ModelExtrasLocation> | PlacedMeshBase<ModelExtrasOverlay>;
export type PlacedModel = {
    models: PlacedMesh[];
    materialId: number;
    material: ParsedMaterial | null;
    hasVertexAlpha: boolean;
    minimapVariant: boolean;
    overlayIndex: number;
    groupid: string;
};
export declare function defaultMorphId(locmeta: objects): number;
export declare function resolveMorphedObject(source: EngineCache, id: number): Promise<{
    rawloc: objects;
    morphedloc: objects;
    resolvedid: number;
}>;
export declare function mapsquareOverlays(engine: EngineCache, grid: TileGrid, locs: WorldLocation[]): Promise<PlacedModel[]>;
export declare function mapsquareObjectModels(cache: CacheFileSource, inst: WorldLocation, minimap?: boolean): {
    models: {
        model: number;
        morph: FloorMorph;
    }[];
    mods: ModelModifications;
    extras: ModelExtrasLocation;
};
export type WorldLocation = {
    x: number;
    z: number;
    type: number;
    rotation: number;
    plane: number;
    locid: number;
    resolvedlocid: number;
    location: objects;
    sizex: number;
    sizez: number;
    placement: mapsquare_locations["locations"][number]["uses"][number]["extra"];
    visualLevel: number;
    effectiveLevel: number;
    forceVisible: boolean;
};
export declare function mapsquareObjects(engine: EngineCache, grid: TileGrid, locations: mapsquare_locations["locations"], originx: number, originz: number, collision?: boolean): Promise<WorldLocation[]>;
export declare function generateLocationMeshgroups(scene: ThreejsSceneCache, locbases: WorldLocation[], minimap?: boolean): Promise<{
    byMaterial: PlacedModel[];
    byLogical: Map<WorldLocation, PlacedMesh[]>;
}>;
declare class RSBatchMesh extends THREE.Mesh {
    renderSections: ThreeJsRenderSection[];
    constructor(geo?: THREE.BufferGeometry, mat?: THREE.Material | THREE.Material[]);
    cloneSection(section: ThreeJsRenderSection): ThreeJsRenderSection;
    setSectionHide(section: ThreeJsRenderSection, hide: boolean): void;
}
export declare function meshgroupsToThree(grid: TileGrid, meshgroup: PlacedModel, rootx: number, rootz: number, material: ParsedMaterial, locrenders: Map<WorldLocation, ThreeJsRenderSection[]>): RSBatchMesh;
export {};
