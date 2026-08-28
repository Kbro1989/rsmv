import type { CacheFileSource } from "../cache";
import { BufferAttribute } from "three";
import { ModelData } from "./rt7model";
export type WorkingSubmesh = {
    pos: BufferAttribute;
    texuvs: BufferAttribute;
    color: BufferAttribute;
    normals: BufferAttribute;
    index: Uint16Array;
    currentface: number;
    matid: number;
};
export declare function parseRT5Model(modelfile: Buffer, source: CacheFileSource): ModelData;
