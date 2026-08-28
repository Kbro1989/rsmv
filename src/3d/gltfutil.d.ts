export declare const TextEncoderPolyfill: typeof TextEncoder;
export type vartypeEnum = 0x1400 | 0x1401 | 0x1402 | 0x1403 | 0x1404 | 0x1405 | 0x1406 | 0x140a | 0x140b;
export type ModelAttribute = {
    byteoffset: number;
    bytestride: number;
    gltype: vartypeEnum;
    name: string;
    veclength: number;
    normalize: boolean;
    min: number[];
    max: number[];
};
export type ArrayBufferConstructor<T> = {
    new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
    readonly BYTES_PER_ELEMENT: number;
};
type typeids = "i8" | "u8" | "i16" | "u16" | "i32" | "u32" | "f32" | "f64" | "f16";
export declare const glTypeIds: {
    [id in typeids]: {
        gltype: vartypeEnum;
        constr: ArrayBufferConstructor<any>;
    };
};
export declare function alignedRefOrCopy<T>(constr: ArrayBufferConstructor<T>, source: Uint8Array, offset: number, length: number): T;
export type AttributeSoure = {
    source: {
        length: number;
        [n: number]: number;
    };
    vecsize: number;
    newtype: keyof typeof glTypeIds;
};
export declare function buildAttributeBuffer<T extends {
    [key: string]: AttributeSoure | undefined;
}>(attrsources: T): {
    buffer: Uint8Array<ArrayBuffer>;
    attributes: { [key in keyof T]: T[key] extends undefined ? never : ModelAttribute; };
    bytestride: number;
    vertexcount: number;
};
export {};
