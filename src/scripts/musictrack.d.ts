import { CacheFileSource } from "../cache";
export declare function parseMusic(source: CacheFileSource, major: number, id: number, firstchunk: Buffer | null, allowdownload?: boolean): Promise<Buffer<ArrayBufferLike>>;
export declare function crc32ogg(buf: Uint8Array | Uint8ClampedArray, crc?: number, rangeStart?: number, rangeEnd?: number): number;
