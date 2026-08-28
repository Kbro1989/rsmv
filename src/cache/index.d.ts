export type SubFile = {
    offset: number;
    size: number;
    buffer: Buffer;
    fileid: number;
    namehash: number | null;
};
export type CacheIndex = {
    major: number;
    minor: number;
    crc: number;
    version: number;
    subindexcount: number;
    subindices: number[];
    subnames: number[] | null;
    name: number | null;
    uncompressed_crc?: number | null;
    size?: number | null;
    uncompressed_size?: number | null;
};
export type CacheIndexFile = CacheIndex[];
export type XteaTable = Map<number, Uint32Array>;
export declare function packSqliteBufferArchive(buffers: Buffer[]): Buffer<ArrayBuffer>;
export declare function unpackSqliteBufferArchive(buffer: Buffer, subids: number[], namehashes: number[] | null): SubFile[];
export declare class Archive {
    files: Buffer[];
    constructor(files: Buffer[]);
    forgecrc(wantedcrc: number, gapfileindex: number, gapoffset: number): void;
    networkFooter(): Buffer<ArrayBuffer>;
    packNetwork(): Buffer<ArrayBuffer>;
    sqliteHeader(): Buffer<ArrayBuffer>;
    packSqlite(): Buffer<ArrayBuffer>;
}
export declare function packBufferArchive(buffers: Buffer[]): Buffer<ArrayBuffer>;
export declare function unpackBufferArchive(buffer: Buffer, subids: number[], namehashes: number[] | null): SubFile[];
export declare function rootIndexBufferToObject(metaindex: Buffer, source: CacheFileSource): CacheIndex[];
export declare function indexBufferToObject(major: number, buffer: Buffer, source: CacheFileSource): CacheIndex[];
export declare const mappedFileIds: {
    19: number;
    18: number;
    22: number;
    17: number;
    16: number;
    20: number;
    21: number;
    57: number;
    26: number;
};
export declare const oldConfigMaps: {
    19: 10;
    18: 9;
    16: 6;
    21: 13;
};
export type FilePosition = {
    major: number;
    minor: number;
    subid: number;
};
export declare function fileIdToArchiveminor(major: number, fileid: number, buildnr: number): FilePosition;
export declare function archiveToFileId(major: number, minor: number, subfile: number): number;
export declare abstract class CacheFileSource {
    decodeArgs: Record<string, any>;
    getCacheMeta(): {
        name: string;
        descr: string;
        timestamp: Date;
        otherCaches?: Record<string, string>;
    };
    getFile(major: number, minor: number, crc?: number): Promise<Buffer>;
    getFileArchive(index: CacheIndex): Promise<SubFile[]>;
    getCacheIndex(major: number): Promise<CacheIndexFile>;
    getBuildNr(): number;
    getDecodeArgs(): Record<string, any>;
    writeFile(major: number, minor: number, file: Buffer): Promise<void>;
    writeFileArchive(major: number, minor: number, files: Buffer[]): Promise<void>;
    getIndexEntryById(major: number, minor: number): Promise<CacheIndex>;
    getArchiveById(major: number, minor: number): Promise<SubFile[]>;
    getFileById(major: number, fileid: number): Promise<Buffer<ArrayBufferLike>>;
    findFileByName(major: number, name: string): Promise<CacheIndex | undefined>;
    findSubfileByName(major: number, minor: number, name: string): Promise<SubFile | undefined>;
    bruteForceFindAnyNamedFile(name: string): Promise<SubFile[] | null>;
    close(): void;
}
export type CacheFileGetter = (major: number, minor: number, crc?: number) => Promise<Buffer>;
export declare abstract class DirectCacheFileSource extends CacheFileSource {
    indexMap: Map<number, Promise<CacheIndexFile>>;
    requiresCrc: boolean;
    xteakeys: XteaTable | null;
    constructor(needscrc: boolean);
    getFile(major: number, minor: number, crc?: number): Promise<Buffer>;
    getFileArchive(meta: CacheIndex): Promise<SubFile[]>;
    getXteaKey(major: number, minor: number): Uint32Array<ArrayBufferLike> | undefined;
    getCacheIndex(major: number): Promise<CacheIndexFile>;
}
export declare class CallbackCacheLoader extends DirectCacheFileSource {
    constructor(fn: CacheFileGetter, needsCrc: boolean);
    getCacheMeta(): {
        name: string;
        descr: string;
        timestamp: Date;
    };
}
