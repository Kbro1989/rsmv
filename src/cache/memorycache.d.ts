import { CacheFileSource, CacheIndex, SubFile } from ".";
export type CachedObject<T> = {
    size: number;
    lastuse: number;
    usecount: number;
    owner: Map<number, CachedObject<T>>;
    id: number;
    promise: Promise<T> | null;
    data: T | null;
};
export declare class CachingFileSource extends CacheFileSource {
    private archieveCache;
    private cachedObjects;
    private cacheFetchCounter;
    private cacheAddCounter;
    maxcachesize: number;
    rawsource: CacheFileSource;
    constructor(base: CacheFileSource);
    fetchCachedObject<T>(map: Map<number, CachedObject<T>>, id: number, create: () => Promise<T>, getSize: (obj: T) => number): Promise<T>;
    sweepCachedObjects(): void;
    getCacheIndex(major: number): Promise<import(".").CacheIndexFile>;
    getFile(major: number, minor: number, crc?: number | undefined): Promise<Buffer<ArrayBufferLike>>;
    getFileArchive(index: CacheIndex): Promise<SubFile[]>;
    getBuildNr(): number;
    getCacheMeta(): {
        name: string;
        descr: string;
        timestamp: Date;
        otherCaches?: Record<string, string>;
    };
}
