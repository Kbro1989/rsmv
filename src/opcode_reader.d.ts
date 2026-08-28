import type * as jsonschema from "json-schema";
export type TypeDef = {
    [name: string]: unknown;
};
export declare function getDebug(trigger: boolean): {
    rootstate: unknown;
    opcodes: {
        op: string;
        index: number;
        stacksize: number;
        jump?: {
            to: number;
        };
    }[];
} | null;
type SharedEncoderState = {
    isWrite: boolean;
    stack: object[];
    hiddenstack: object[];
    scan: number;
    endoffset: number;
    buffer: Buffer;
    args: Record<string, unknown>;
};
export type DecodeState = SharedEncoderState & {
    isWrite: false;
};
export type EncodeState = SharedEncoderState & {
    isWrite: true;
};
export type ResolvedReference = {
    stackdepth: number;
    resolve(v: unknown, oldvalue: number): number;
};
export type ChunkParser = {
    read(state: DecodeState): any;
    write(state: EncodeState, v: unknown): void;
    getTypescriptType(indent: string): string;
    getJsonSchema(): jsonschema.JSONSchema6Definition;
    readConst?(state: SharedEncoderState): any;
};
type ChunkParentCallback = (prop: string, childresolve: ResolvedReference) => ResolvedReference;
export declare function buildParser(parent: ChunkParentCallback | null, chunkdef: unknown, typedef: TypeDef): ChunkParser;
export declare function buildReference(name: string, container: ChunkParentCallback | null, startingpoint: ResolvedReference): ResolvedReference;
export {};
