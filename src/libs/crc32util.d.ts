export declare function crc32(buf: Uint8Array | Uint8ClampedArray, crc?: number, rangeStart?: number, rangeEnd?: number): number;
export declare function crc32addInt(int: number, crc: number): number;
export declare class CrcBuilder {
    crc: number;
    constructor(initcrc?: number);
    addbyte(byte: number): void;
    addUint16Flipped(u16: number): void;
    addUint16(u16: number): void;
    addUint32(u16: number): void;
    get(): number;
    fork(): CrcBuilder;
}
/**
 * Used to hash parts of an interlaced buffer
 * @param buf the interlaced buffer
 * @param offset offset of byte group
 * @param stride number of bytes between the start of each occurance of the byte group
 * @param bytes number of bytes per group
 * @param chunkcount number of groups
 * @param crc optional starting value for crc
 */
export declare function crc32Interlaced(buf: Uint8Array, offset: number, stride: number, bytes: number, chunkcount: number, crc?: number): number;
export declare function crc32_backward(buf: Uint8Array, crc: number, rangeStart?: number, rangeEnd?: number): number;
export declare function intbuffer(value: number, bigendian?: boolean, bytes?: number): Buffer<ArrayBuffer>;
export declare function forge_crcbytes(frontcrc: number, backcrc: number): Buffer<ArrayBuffer>;
export declare function forge(str: Uint8Array, wanted_crc: number, pos?: number, insert?: boolean): Buffer<ArrayBuffer>;
