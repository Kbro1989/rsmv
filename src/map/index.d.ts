import { ThreeJsRenderer } from "../viewer/threejsrender";
import { ParsemapOpts, MapRect, TileGrid, RSMapChunkData, parseMapsquare } from "../3d/mapsquare";
import { CacheFileSource } from "../cache";
import { EngineCache, ThreejsSceneCache } from "../3d/modeltothree";
import { DependencyGraph } from "../scripts/dependencies";
import { ScriptOutput } from "../scriptrunner";
import { ChunkRenderMeta, RenderDepsTracker } from "./chunksummary";
import { RSMapChunk } from "../3d/modelnodes";
import { Camera, Matrix4, OrthographicCamera } from "three";
import { MapRender, VersionFilter } from "./backends";
import { ProgressUI, TileLoadState } from "./progressui";
import { MipScheduler } from "./mipper";
export type RenderedMapMeta = {
    versions: {
        version: number;
        date: number;
        build: number;
        source: string;
    }[];
};
export type Mapconfig = {
    layers: LayerConfig[];
    tileimgsize: number;
    mapsizex: number;
    mapsizez: number;
    area: string;
    noyflip: boolean | undefined;
    nochunkoffset: boolean | undefined;
};
export type LayerConfig = {
    mode: string;
    name: string;
    pxpersquare: number;
    level: number;
    format?: "png" | "webp";
    mipmode?: "default" | "avg";
    usegzip?: boolean;
    subtractlayers?: string[];
} & ({
    mode: "3d" | "minimap" | "interactions";
    dxdy: number;
    dzdy: number;
    hidelocs?: boolean;
    overlaywalls?: boolean;
    overlayicons?: boolean;
} | {
    mode: "map";
    wallsonly?: boolean;
    mapicons?: boolean;
    thicklines?: boolean;
} | {
    mode: "height";
    allcorners?: boolean;
} | {
    mode: "collision";
} | {
    mode: "locs";
} | {
    mode: "maplabels";
} | {
    mode: "rendermeta";
});
export declare function purgeBadRenders(config: MapRender, versionfilter: VersionFilter): Promise<void>;
export declare function runMapRender(output: ScriptOutput, filesource: CacheFileSource, config: MapRender, forceCheck: boolean): Promise<() => void>;
type MaprenderSquareData = {
    grid: TileGrid;
    chunkdata: RSMapChunkData;
    rendermeta: ChunkRenderMeta;
};
type MaprenderSquare = {
    parseprom: ReturnType<typeof parseMapsquare>;
    x: number;
    z: number;
    id: number;
    model: RSMapChunk | null;
    loaded: MaprenderSquareData | null;
    loadprom: Promise<MaprenderSquareData> | null;
};
export declare class MapRenderer {
    renderer: ThreeJsRenderer;
    engine: EngineCache;
    config: MapRender;
    scenecache: ThreejsSceneCache | null;
    maxunused: number;
    minunused: number;
    idcounter: number;
    squares: MaprenderSquare[];
    deps: DependencyGraph;
    loadcallback: ((x: number, z: number, state: TileLoadState) => void) | null;
    opts: ParsemapOpts;
    constructor(cnv: HTMLCanvasElement, config: MapRender, engine: EngineCache, deps: DependencyGraph, opts: ParsemapOpts);
    private getChunk;
    setArea(x: number, z: number, xsize: number, zsize: number, needsmodels: boolean): Promise<MaprenderSquare[]>;
}
export declare function downloadMap(output: ScriptOutput, getRenderer: () => MapRenderer, engine: EngineCache, deps: DependencyGraph, rects: MapRect[], config: MapRender, progress: ProgressUI): Promise<void>;
export declare function renderMapsquare(engine: EngineCache, config: MapRender, depstracker: RenderDepsTracker, mipper: MipScheduler, progress: ProgressUI, chunkx: number, chunkz: number): {
    runTasks: (renderpromise: Promise<MapRenderer>) => Promise<void>;
};
export declare function mapImageCamera(x: number, z: number, ntiles: number, dxdy: number, dzdy: number): Camera;
export declare class SkewOrthographicCamera extends OrthographicCamera {
    skewMatrix: Matrix4;
    constructor(ntiles: number, dxdy: number, dzdy: number);
    pointDown(): void;
    setSkew(dxdz: number, dydz: number): void;
    updateProjectionMatrix(): void;
}
export {};
