import type { materials } from "../../generated/materials";
import type { CacheFileSource } from "cache";
type TextureRepeatMode = "clamp" | "repeat" | "mirror";
export type MaterialData = {
    textures: {
        diffuse?: number;
        normal?: number;
        compound?: number;
    };
    texmodes: TextureRepeatMode;
    texmodet: TextureRepeatMode;
    uvAnim: {
        u: number;
        v: number;
    } | undefined;
    baseColorFraction: number;
    baseColor: [number, number, number];
    alphamode: "opaque" | "cutoff" | "blend";
    alphacutoff: number;
    stripDiffuseAlpha: boolean;
    raw: materials | null;
};
export declare function defaultMaterial(): MaterialData;
export declare function materialCacheKey(matid: number, hasVertexAlpha: boolean, minimapVariant: boolean): number;
export declare function convertMaterial(data: Buffer, materialid: number, source: CacheFileSource): MaterialData;
export {};
