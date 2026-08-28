import { FileParser } from "../opdecoder";
import { CacheFileSource, CacheIndex } from "../cache";
import { ScriptFS } from "../scriptrunner";
type CacheFileId = {
    index: CacheIndex;
    subindex: number;
};
type LogicalIndex = number[];
export type DecodeModeFactory = (flags: Record<string, string>) => DecodeMode;
type FileId = {
    major: number;
    minor: number;
    subid: number;
};
type DecodeLookup = {
    major: number | undefined;
    minor: number | undefined;
    logicalDimensions: number;
    usesArchieves: boolean;
    logicalRangeToFiles(source: CacheFileSource, start: LogicalIndex, end: LogicalIndex): Promise<CacheFileId[]>;
    fileToLogical(source: CacheFileSource, major: number, minor: number, subfile: number): LogicalIndex;
    logicalToFile(source: CacheFileSource, id: LogicalIndex): FileId;
};
export type DecodeMode<T = Buffer | string> = {
    ext: string;
    parser?: FileParser<any>;
    read(buf: Buffer, fileid: LogicalIndex, source: CacheFileSource): T | Promise<T>;
    prepareDump(output: ScriptFS, source: CacheFileSource): Promise<void> | void;
    prepareWrite(source: CacheFileSource): Promise<void> | void;
    write(file: Buffer, fileid: LogicalIndex, source: CacheFileSource): Buffer | Promise<Buffer>;
    combineSubs(files: T[]): T;
    description: string;
    flagtemplate?: Record<string, {
        text: string;
        type: "boolean";
    }>;
} & DecodeLookup;
export type JsonBasedFile = {
    parser: FileParser<any>;
    lookup: DecodeLookup;
    prepareParser?: (source: CacheFileSource) => Promise<void> | void;
    prepareDump?: (source: CacheFileSource) => Promise<void> | void;
};
export declare const cacheFileJsonModes: {
    framemaps: JsonBasedFile;
    items: JsonBasedFile;
    enums: JsonBasedFile;
    npcs: JsonBasedFile;
    soundjson: JsonBasedFile;
    musicjson: JsonBasedFile;
    objects: JsonBasedFile;
    achievements: JsonBasedFile;
    structs: JsonBasedFile;
    sequences: JsonBasedFile;
    spotanims: JsonBasedFile;
    materials: JsonBasedFile;
    oldmaterials: JsonBasedFile;
    quickchatcats: JsonBasedFile;
    quickchatlines: JsonBasedFile;
    dbtables: JsonBasedFile;
    dbrows: JsonBasedFile;
    overlays: JsonBasedFile;
    identitykit: JsonBasedFile;
    params: JsonBasedFile;
    underlays: JsonBasedFile;
    mapscenes: JsonBasedFile;
    environments: JsonBasedFile;
    animgroupconfigs: JsonBasedFile;
    maplabels: JsonBasedFile;
    mapzones: JsonBasedFile;
    cutscenes: JsonBasedFile;
    particles0: JsonBasedFile;
    particles1: JsonBasedFile;
    maptiles: JsonBasedFile;
    maptiles_nxt: JsonBasedFile;
    maplocations: JsonBasedFile;
    mapenvs: JsonBasedFile;
    maptiles_old: JsonBasedFile;
    maplocations_old: JsonBasedFile;
    frames: JsonBasedFile;
    models: JsonBasedFile;
    oldmodels: JsonBasedFile;
    skeletons: JsonBasedFile;
    proctextures: JsonBasedFile;
    oldproctextures: JsonBasedFile;
    interfaces: JsonBasedFile;
    fontmetrics: JsonBasedFile;
    classicmodels: JsonBasedFile;
    indices: JsonBasedFile;
    rootindex: JsonBasedFile;
    test: JsonBasedFile;
    clientscriptops: JsonBasedFile;
};
export declare const cacheFileDecodeGroups: {
    image: {
        sprites: DecodeModeFactory;
        textures_dds: DecodeModeFactory;
        textures_png: DecodeModeFactory;
        textures_bmp: DecodeModeFactory;
        textures_ktx: DecodeModeFactory;
    };
    legacyImage: {
        legacy_sprites: DecodeModeFactory;
        legacy_textures: DecodeModeFactory;
        textures_proc: DecodeModeFactory;
        textures_oldpng: DecodeModeFactory;
        textures_2015png: DecodeModeFactory;
        textures_2015dds: DecodeModeFactory;
        textures_2015pngmips: DecodeModeFactory;
        textures_2015compoundpng: DecodeModeFactory;
        textures_2015compounddds: DecodeModeFactory;
        textures_2015compoundpngmips: DecodeModeFactory;
    };
    interactive: {
        cutscenehtml: DecodeModeFactory;
        interfacehtml: DecodeModeFactory;
        interfaceviewer: DecodeModeFactory;
        fontviewer: DecodeModeFactory;
        clientscript: DecodeModeFactory;
        clientscriptviewer: DecodeModeFactory;
    };
    sound: {
        sounds: DecodeModeFactory;
        musicfragments: DecodeModeFactory;
        music: DecodeModeFactory;
    };
    other: {
        bin: DecodeModeFactory;
        spritehash: DecodeModeFactory;
        fonthash: DecodeModeFactory;
        modelhash: DecodeModeFactory;
        npcmodels: DecodeModeFactory;
    };
    json: Record<"models" | "test" | "params" | "fontmetrics" | "items" | "enums" | "mapscenes" | "sequences" | "framemaps" | "frames" | "oldmodels" | "classicmodels" | "materials" | "oldmaterials" | "environments" | "identitykit" | "structs" | "maplabels" | "cutscenes" | "interfaces" | "dbtables" | "dbrows" | "objects" | "overlays" | "underlays" | "npcs" | "spotanims" | "achievements" | "indices" | "soundjson" | "musicjson" | "quickchatcats" | "quickchatlines" | "animgroupconfigs" | "mapzones" | "particles0" | "particles1" | "maptiles" | "maptiles_nxt" | "maplocations" | "mapenvs" | "maptiles_old" | "maplocations_old" | "skeletons" | "proctextures" | "oldproctextures" | "rootindex" | "clientscriptops", DecodeModeFactory>;
};
export declare const cacheFileDecodeModes: {
    [k: string]: DecodeModeFactory;
};
export {};
