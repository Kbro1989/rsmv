export declare function decompress(input: Buffer, key?: Uint32Array): Buffer<any>;
export declare function compressSqlite(input: Buffer, compression: "zlib"): Buffer<ArrayBuffer>;
export declare function legacybz2(input: Buffer): Buffer<any>;
export declare function legacyGzip(input: Buffer): NonSharedBuffer;
