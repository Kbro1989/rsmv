import * as cache from "./index";
import { FileSourceFsCache } from "./fscache";
export type Openrs2CacheMeta = {
    id: number;
    scope: string;
    game: string;
    environment: string;
    language: string;
    builds: {
        major: number;
        minor: number | null;
    }[];
    timestamp: string | null;
    sources: string[];
    valid_indexes: number;
    indexes: number;
    valid_groups: number;
    groups: number;
    valid_keys: number;
    keys: number;
    size: number;
    blocks: number;
    disk_store_valid: boolean;
};
export declare function loadOpenrsCachelist(): Promise<Openrs2CacheMeta[]>;
export declare function validOpenrs2Caches(): Promise<Openrs2CacheMeta[]>;
export declare function openrs2GetEffectiveBuildnr(cachemeta: Openrs2CacheMeta): number;
export declare class Openrs2CacheSource extends cache.DirectCacheFileSource {
    meta: Openrs2CacheMeta;
    buildnr: number;
    xteaKeysLoaded: boolean;
    xteakeysPromise: Promise<void> | null;
    fscache: FileSourceFsCache | null;
    static fromId(cacheid: number): Promise<Openrs2CacheSource>;
    constructor(meta: Openrs2CacheMeta);
    getCacheMeta(): {
        name: string;
        descr: string;
        timestamp: Date;
    };
    getBuildNr(): number;
    getCacheIndex(major: number): Promise<cache.CacheIndexFile>;
    static getRecentCache(count?: number): Promise<Openrs2CacheMeta>;
    downloadFile(major: number, minor: number): Promise<Buffer<ArrayBuffer>>;
    getFile(major: number, minor: number, crc?: number): Promise<Buffer<any>>;
}
