import { CacheFileSource, SubFile } from "./index";
import { EngineCache } from "../3d/modeltothree";
export declare const legacyMajors: {
    readonly data: 0;
    readonly oldmodels: 1;
    readonly oldframebases: 2;
    readonly map: 4;
};
export declare const legacyGroups: {
    readonly config: 2;
    readonly sprites: 4;
    readonly index: 5;
    readonly textures: 6;
};
export declare function parseLegacyArchive(file: Buffer, major: number, isclassic: boolean): SubFile[];
type Mapinfo = Map<number, {
    map: number;
    loc: number;
    crc: number;
    version: number;
}>;
type LegacyKeys = "items" | "objects" | "overlays" | "underlays" | "npcs" | "spotanims";
export type LegacyData = Record<LegacyKeys, Buffer[]> & {
    mapmeta: Mapinfo;
};
export declare function legacyPreload(engine: EngineCache): Promise<LegacyData>;
export declare function parseLegacyImageFile(source: CacheFileSource, buf: Buffer): Promise<import("../3d/sprite").SubImageData>;
export declare function combineLegacyTexture(engine: EngineCache, name: string, subname: string, useTga: boolean): Promise<import("../3d/sprite").SubImageData>;
export {};
