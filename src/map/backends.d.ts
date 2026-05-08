import { LayerConfig, Mapconfig } from ".";
import { ScriptFS } from "../scriptrunner";
export type VersionFilter = {
    from?: number;
    to?: number;
};
export type UniqueMapFile = {
    name: string;
    hash: number;
};
export type KnownMapFile = {
    hash: number;
    fshash: number;
    file: string;
    time: number;
    buildnr: number;
    firstbuildnr: number;
};
export type SymlinkCommand = {
    file: string;
    buildnr: number;
    hash: number;
    symlink: string;
    symlinkbuildnr: number;
    symlinkfirstbuildnr: number;
};
export declare function parseMapConfig(configfile: string): any;
export declare abstract class MapRender {
    config: Mapconfig;
    version: number;
    workerid: string;
    constructor(config: Mapconfig);
    abstract getFileResponse(name: string, version?: number): Promise<Response>;
    abstract makeFileName(layer: string, zoom: number, x: number, y: number, ext: string): string;
    abstract saveFile(name: string, hash: number, data: Buffer, version?: number): Promise<void>;
    abstract symlink(name: string, hash: number, symlinktarget: string, symlinkversion?: number): Promise<void>;
    symlinkBatch(files: SymlinkCommand[]): Promise<void>;
    beginMapVersion(version: number): Promise<void>;
    rendermetaLayer: LayerConfig | undefined;
    getRelatedFiles(names: string[], versions: number[]): Promise<KnownMapFile[]>;
    getMetas(names: UniqueMapFile[]): Promise<KnownMapFile[]>;
}
export declare class MapRenderFsBacked extends MapRender {
    fs: ScriptFS;
    constructor(fs: ScriptFS, config: Mapconfig);
    makeFileName(layer: string, zoom: number, x: number, y: number, ext: string): string;
    assertVersion(version?: number): void;
    saveFile(name: string, hash: number, data: Buffer, version: number): Promise<void>;
    getFileResponse(name: string, version?: number): Promise<Response>;
    symlink(name: string, hash: number, targetname: string, targetversion: number): Promise<void>;
}
export declare class MapRenderDatabaseBacked extends MapRender {
    endpoint: string;
    workerid: string;
    uploadmapid: number;
    auth: string;
    overwrite: boolean;
    ignorebefore: Date;
    rendermetaLayer: LayerConfig | undefined;
    private postThrottler;
    private fileThrottler;
    constructor(endpoint: string, auth: string, workerid: string, uploadmapid: number, config: Mapconfig, rendermetaLayer: LayerConfig | undefined, overwrite: boolean, ignorebefore: Date);
    static create(endpoint: string, auth: string, uploadmapid: number, overwrite: boolean, ignorebefore: Date): Promise<MapRenderDatabaseBacked>;
    makeFileName(layer: string, zoom: number, x: number, y: number, ext: string): string;
    beginMapVersion(version: number): Promise<void>;
    saveFile(name: string, hash: number, data: Buffer, version?: number): Promise<void>;
    symlink(name: string, hash: number, targetname: string, targetversion: number): Promise<void>;
    symlinkBatch(files: SymlinkCommand[]): Promise<void>;
    getMetas(names: UniqueMapFile[]): Promise<KnownMapFile[]>;
    getRelatedFiles(names: string[], versions: number[]): Promise<KnownMapFile[]>;
    getFileResponse(name: string, version?: number): Promise<Response>;
}
export declare const examplemapconfig = "\n{\n\t\"$schema\": \"../generated/maprenderconfig.schema.json\",\n\t//test gives a 3x3 area around lumby, \"main\" for the main world map, \"full\" for everything, a list of rectangles is also accepted eg: \"50.50,20.20-70.70\"\n\t\"area\": \"test\",//\"45.45-55.55\", //\"50.45-51.46\",\n\t//the size of the output images, usually 256 or 512\n\t\"tileimgsize\": 512,\n\t//set to true to keep the output y origin at the bottom left, equal to the game z origin\n\t\"noyflip\": false,\n\t//set to true to keep output chunks aligned with in-game chunks. Incurs performance penalty as more neighbouring chunks have to be loaded\n\t\"nochunkoffset\": false,\n\t//list of layers to render\n\t\"layers\": [\n\t\t{\n\t\t\t\"name\": \"level-0\", //name of the layer, this will be the folder name\n\t\t\t\"mode\": \"3d\", //3d world render\n\t\t\t\"format\": \"webp\", //currently only png and webp. jpeg in theory supported but not implemented or tested\n\t\t\t\"level\": 0, //floor level of the render, 0 means ground floor and all roofs are hidden, highest level is 3 which makes all roofs visible\n\t\t\t\"pxpersquare\": 64, //the level of detail for highest zoom level measured in pixels per map tile (1x1 meter). Subject to pxpersquare*64>tileimgsize, because it is currently not possible to render less than one image per mapchunk\n\t\t\t\"dxdy\": 0.15, //dxdy and dzdy to determine the view angle, 0,0 for straight down, something like 0.15,0.25 for birds eye\n\t\t\t\"dzdy\": 0.25\n\t\t},\n\t\t{\n\t\t\t\"name\": \"topdown-0\", //name of the layer, this will be the folder name\n\t\t\t\"mode\": \"3d\", //3d world render\n\t\t\t\"format\": \"webp\", //currently only png and webp. jpeg in theory supported but not implemented or tested\n\t\t\t\"level\": 0, //floor level of the render, 0 means ground floor and all roofs are hidden, highest level is 3 which makes all roofs visible\n\t\t\t\"pxpersquare\": 64, //the level of detail for highest zoom level measured in pixels per map tile (1x1 meter). Subject to pxpersquare*64>tileimgsize, because it is currently not possible to render less than one image per mapchunk\n\t\t\t\"dxdy\": 0, //dxdy and dzdy to determine the view angle, 0,0 for straight down, something like 0.15,0.25 for birds eye\n\t\t\t\"dzdy\": 0\n\t\t},\n\t\t{\n\t\t\t\"name\": \"map\",\n\t\t\t\"mode\": \"map\", //old style 2d map render\n\t\t\t\"format\": \"png\",\n\t\t\t\"level\": 0,\n\t\t\t\"pxpersquare\": 64,\n\t\t\t\"mapicons\": true,\n\t\t\t\"wallsonly\": false //can be turned on to create a walls overlay layer to use on top of an existing 3d layer\n\t\t},\n\t\t{\n\t\t\t\"name\": \"minimap\",\n\t\t\t\"mode\": \"minimap\", //minimap style render, similar to 3d but uses different shaders and emulates several rs bugs.\n\t\t\t\"format\": \"webp\",\n\t\t\t\"level\": 0,\n\t\t\t\"pxpersquare\": 64,\n\t\t\t\"hidelocs\": false, //can be turned on to emulate partially loaded minimap\n\t\t\t\"mipmode\": \"avg\", //results in every pixel of a mip image being exactly the mean of 4 zoomed pixels without any other filtering steps, required for minimap localization\n\t\t\t\"dxdy\": 0,\n\t\t\t\"dzdy\": 0\n\t\t},\n\t\t{\n\t\t\t\"name\": \"collision\",\n\t\t\t\"mode\": \"collision\", //pathing/line of sight as overlay image layer to use on \"map\" or \"3d\"\n\t\t\t\"format\": \"png\",\n\t\t\t\"level\": 0,\n\t\t\t\"pxpersquare\": 64\n\t\t},\n\t\t{\n\t\t\t\"name\": \"height\",\n\t\t\t\"mode\": \"height\", //binary file per chunk containing 16bit height data and 16 bits of collision data in base3 per tile\n\t\t\t\"level\": 0,\n\t\t\t\"pxpersquare\": 1, //unused but required\n\t\t\t\"usegzip\": true //gzips the resulting file, need some server config to serve the compressed file\n\t\t},\n\t\t{\n\t\t\t\"name\": \"locs\",\n\t\t\t\"mode\": \"locs\", //json file with locs per chunk\n\t\t\t\"level\": 0,\n\t\t\t\"pxpersquare\": 1, //unused but required\n\t\t\t\"usegzip\": false\n\t\t},\n\t\t{\n\t\t\t\"name\": \"maplabels\",\n\t\t\t\"mode\": \"maplabels\", //json file per chunk containing maplabel images and uses\n\t\t\t\"level\": 0,\n\t\t\t\"pxpersquare\": 1,\n\t\t\t\"usegzip\": false\n\t\t},\n\t\t{\n\t\t\t\"name\": \"rendermeta\",\n\t\t\t\"mode\": \"rendermeta\", //advanced - json file containing metadata about the chunk render, used to dedupe historic renders\n\t\t\t\"level\": 0,\n\t\t\t\"pxpersquare\": 1\n\t\t},\n\t\t{\n\t\t\t\"name\": \"interactions\",\n\t\t\t\"mode\": \"interactions\",\n\t\t\t\"pxpersquare\": 64, //same arguments as mode=\"3d\"\n\t\t\t\"dxdy\": 0.15,\n\t\t\t\"dzdy\": 0.25,\n\t\t\t\"format\": \"webp\",\n\t\t\t\"level\": 0,\n\t\t\t\"usegzip\": true\n\t\t}\n\t],\n\t//used to determine lowest scaling mip level, should generally always be 100,200 which ensures the lowest mip level contains the entire rs world in one image\n\t\"mapsizex\": 100,\n\t\"mapsizez\": 200\n}";
