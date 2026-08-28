export type AsyncReturnType<T extends (...args: any[]) => Promise<any>> = T extends (...args: any[]) => Promise<infer Q> ? Q : never;
export type FileRange = {
    start: [number, number, number];
    end: [number, number, number];
};
export type ModelModifications = {
    replaceColors?: [from: number, to: number][];
    replaceMaterials?: [from: number, to: number][];
    lodLevel?: number;
};
export type Stream = {
    getData(): Buffer;
    skip(n: number): Stream;
    scanloc(): number;
    readByte(): number;
    readUByte(): number;
    readUShortSmart(): number;
    readShortSmart(): number;
    readShortSmartBias(): number;
    readShort(flip?: boolean): number;
    readUShort(flip?: boolean): number;
    readUInt(flip?: boolean): number;
    readUIntSmart(): number;
    readTribyte(): number;
    readFloat(flip?: boolean, signage?: boolean): number;
    readHalf(flip?: boolean): number;
    eof(): boolean;
    bytesLeft(): number;
    readBuffer(len?: number): Buffer;
    tee(): Stream;
};
export declare function checkObject<T extends {
    [key: string]: "string" | "number" | "boolean";
}>(obj: unknown, props: T): { [key in keyof T]: T[key] extends "string" ? string : T[key] extends "number" ? T[key] extends "boolean" ? boolean : number : never; } | null;
export declare function cacheFilenameHash(name: string, oldhash: boolean): number;
export declare function stringToMapArea(str: string): {
    x: number;
    z: number;
    xsize: number;
    zsize: number;
} | null;
export declare function stringToFileRange(str: string): FileRange[];
export declare function getOrInsert<K, V>(map: Map<K, V>, key: K, fallback: () => (V extends never ? never : V)): V;
export declare function delay(ms: number): Promise<unknown>;
export declare function posmod(x: number, n: number): number;
export declare function escapeHTML(str: string): string;
export declare function rsmarkupToSafeHtml(str: string): string;
/**
 * used to get an array with enum typing
 */
export declare function arrayEnum<Q extends string>(v: Q[]): Q[];
/**
 * Used to provide literal typing of map keys while also constraining each value
 */
export declare function constrainedMap<Q>(): <T extends {
    [key: string]: Q;
}>(v: T) => { [k in keyof T]: Q; };
export declare const Stream: {
    new (buf: Buffer): Stream;
    prototype: Stream;
};
export declare function flipEndian16(u16: number): number;
export declare function ushortToHalf(bytes: number): number;
export declare function HSL2RGBfloat(hsl: number[]): [number, number, number];
export declare function HSL2RGB(hsl: number[]): [number, number, number];
export declare function RGB2HSL(r: number, g: number, b: number): [number, number, number];
export declare function HSL2packHSL(h: number, s: number, l: number): number;
export declare function packedHSL2HSL(hsl: number): number[];
export declare class TypedEmitter<T extends Record<string, any>> {
    protected listeners: {
        [key in keyof T]?: Set<(v: T[key]) => void>;
    };
    on<K extends keyof T>(event: K, listener: (v: T[K]) => void): void;
    once<K extends keyof T>(event: K, listener: (v: T[K]) => void): void;
    off<K extends keyof T>(event: K, listener: (v: T[K]) => void): void;
    emit<K extends keyof T>(event: K, value: T[K]): void;
}
export declare class CallbackPromise<T = void> extends Promise<T> {
    done: (v: T) => void;
    err: (e: Error) => void;
    constructor(exe?: (done: (v: T) => void, err: (e: Error) => void) => void);
}
export declare function trickleTasks(name: string, parallel: number, tasks: Iterable<Promise<any>> | (() => Iterable<Promise<any>>)): Promise<void>;
export declare function trickleTasksTwoStep<T>(parallel: number, tasks: () => Iterable<Promise<T>>, steptwo: (v: T) => void): Promise<void>;
export declare class FetchThrottler {
    private reqQueue;
    private activeReqs;
    private maxParallelReqs;
    constructor(maxParallelReqs: number);
    apiRequest(url: string, init?: RequestInit & {
        timeout?: number;
    }, retrycount?: number, retrydelay?: number): Promise<Response>;
}
interface WeakKeyTypes {
    object: object;
}
type WeakKey = WeakKeyTypes[keyof WeakKeyTypes];
export declare class IterableWeakMap<K extends WeakKey, V> {
    weakMap: WeakMap<K, {
        value: V;
        ref: WeakRef<K>;
    }>;
    refSet: Set<WeakRef<K>>;
    finalizationGroup: FinalizationRegistry<{
        set: any;
        ref: any;
    }>;
    static cleanup({ set, ref }: {
        set: any;
        ref: any;
    }): void;
    constructor();
    set(key: K, value: V): void;
    get(key: K): V | undefined;
    getOrInsert(key: K, data: () => V): V;
    delete(key: K): boolean;
    [Symbol.iterator](): Generator<[K, V], void, unknown>;
    entries(): Generator<[K, V], void, unknown>;
    keys(): Generator<K, void, unknown>;
    values(): Generator<V, void, unknown>;
}
export declare class WeakRefMap<K, V extends WeakKey> {
    private map;
    private registry;
    set(key: K, value: V): void;
    delete(key: K): void;
    get(key: K): V | undefined;
    getOrDefault(key: K, create: () => V): V;
    keys(): Generator<K, void, unknown>;
    values(): Generator<V, void, unknown>;
    [Symbol.iterator](): Generator<[K, V], void, unknown>;
}
export declare function findParentElement(el: HTMLElement | null, cond: (el: HTMLElement) => boolean, fallback?: HTMLElement | null): HTMLElement | null;
export {};
