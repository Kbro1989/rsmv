import { Box2, Group, Matrix4, Vector2 } from "three";
import { objects } from "../../generated/objects";
import { ChunkData, MapRect, PlacedMesh, TileGrid, WorldLocation } from "../3d/mapsquare";
import { ThreejsSceneCache } from "../3d/modeltothree";
import { DependencyGraph } from "../scripts/dependencies";
import { KnownMapFile, MapRender } from "./backends";
import { CacheFileSource } from "../cache";
import { RenderedMapMeta } from ".";
export declare function getLocImageHash(grid: TileGrid, info: WorldLocation): number;
export declare function chunkSummary(grid: TileGrid, locdefs: Map<WorldLocation, PlacedMesh[]>, rect: MapRect): {
    locs: {
        id: number;
        x: number;
        z: number;
        l: number;
        r: number;
        h: number;
        center: number[];
    }[];
    locdatas: {
        [k: string]: objects;
    };
    hashes: Map<number, {
        center: number[];
        locdata: WorldLocation;
    }>;
};
export type ChunkLocDependencies = {
    id: number;
    dependencyhash: number;
    instances: {
        visualLevel: number;
        placementhash: number;
        plane: number;
        x: number;
        z: number;
        rotation: number;
        type: number;
        bounds: number[];
    }[];
};
export type ChunkTileDependencies = {
    x: number;
    z: number;
    xzsize: number;
    maxy: number;
    tilehashes: number[];
    dephash: number;
};
export declare function mapsquareFloorDependencies(grid: TileGrid, deps: DependencyGraph, chunk: ChunkData): ChunkTileDependencies[];
export declare function mapsquareLocDependencies(grid: TileGrid, deps: DependencyGraph, locs: Map<WorldLocation, PlacedMesh[]>, chunkx: number, chunkz: number): ChunkLocDependencies[];
export declare function compareFloorDependencies(tilesa: ChunkTileDependencies[], tilesb: ChunkTileDependencies[], levela: number, levelb: number): number[][];
export declare function compareLocDependencies(chunka: ChunkLocDependencies[], chunkb: ChunkLocDependencies[], levela: number, levelb: number): number[][];
export declare function mapdiffmesh(scene: ThreejsSceneCache, points: number[][], col?: [number, number, number]): Promise<Group<import("three").Object3DEventMap>>;
type KMeansBucket = {
    center: Vector2;
    bounds: Box2;
    sum: Vector2;
    runningbounds: Box2;
    samples: number;
};
export declare function generateLocationHashBoxes(scene: ThreejsSceneCache, locs: Map<WorldLocation, PlacedMesh[]>, grid: TileGrid, chunkx: number, chunkz: number, level: number): Promise<Group<import("three").Object3DEventMap>>;
export declare function generateFloorHashBoxes(scene: ThreejsSceneCache, grid: TileGrid, chunk: ChunkData, level: number): Promise<Group<import("three").Object3DEventMap>>;
export declare function pointsIntersectProjection(projection: Matrix4, points: number[][]): boolean;
/**
 * this class is wayyy overkill for what is currently used
 */
export declare class ImageDiffGrid {
    gridsize: number;
    grid: Uint8Array<ArrayBuffer>;
    addPolygons(projection: Matrix4, points: number[][]): void;
    coverage(): number;
    calculateDiffArea(imgwidth: number, imgheight: number): {
        rects: {
            x: number;
            y: number;
            width: number;
            height: number;
        }[];
        buckets: KMeansBucket[];
    };
}
export type ChunkRenderMeta = {
    x: number;
    z: number;
    version: number;
    floor: ChunkTileDependencies[];
    locs: ChunkLocDependencies[];
};
type RenderDepsEntry = {
    x: number;
    z: number;
    metas: Promise<{
        buildnr: number;
        firstbuildnr: number;
        meta: ChunkRenderMeta;
    }[]>;
};
export type RenderDepsVersionInstance = Awaited<ReturnType<RenderDepsTracker["forkDeps"]>>;
export declare class RenderDepsTracker {
    config: MapRender;
    deps: DependencyGraph;
    targetversions: number[];
    cachedMetas: RenderDepsEntry[];
    readonly cacheSize = 15;
    constructor(source: CacheFileSource, config: MapRender, deps: DependencyGraph, rendermeta: RenderedMapMeta);
    getEntry(x: number, z: number): RenderDepsEntry;
    getRect(rect: MapRect): RenderDepsEntry[];
    forkDeps(names: string[]): Promise<{
        allFiles: KnownMapFile[];
        findMatches: (chunkRect: MapRect, name: string) => Promise<{
            file: KnownMapFile;
            metas: ChunkRenderMeta[];
        }[]>;
        addLocalFile: (file: KnownMapFile) => void;
        addLocalSquare: (rendermeta: ChunkRenderMeta) => void;
    }>;
}
export {};
