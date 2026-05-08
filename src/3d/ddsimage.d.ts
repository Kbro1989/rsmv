export declare function readKtx(filedata: Buffer): {
    isDxt1: boolean;
    isDxt5: boolean;
    mips: {
        width: number;
        height: number;
        data: Buffer;
    }[];
    width: number;
    height: number;
};
export declare function readDds(filedata: Buffer): {
    magic: number;
    flags: number;
    height: number;
    width: number;
    pitchorlinearsize: number;
    depth: number;
    isDxt1: boolean;
    isDxt5: boolean;
    mips: {
        width: number;
        height: number;
        data: Buffer;
    }[];
};
/**
 * @param
 * @param padding size to subtract, will auto-detect to create power of 2 sprite if left at -1
 */
export declare function loadDds(filedata: Buffer, paddingsize?: number, forceOpaque?: boolean): {
    data: Buffer<ArrayBuffer>;
    width: number;
    height: number;
};
/**
 * @param
 * @param padding size to subtract, will auto-detect to create power of 2 sprite if left at -1
 */
export declare function loadKtx(filedata: Buffer, paddingsize?: number, forceOpaque?: boolean): {
    data: Buffer<ArrayBuffer>;
    width: number;
    height: number;
};
