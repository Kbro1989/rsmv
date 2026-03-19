import { ShaderMaterial, Texture } from "three";
import { MaterialData } from "../3d/jmat";
export declare function minimapLocMaterial(texture: Texture, alphamode: MaterialData["alphamode"], alphathreshold: number): ShaderMaterial;
export declare function minimapFloorMaterial(texture: Texture): ShaderMaterial;
export declare function minimapWaterMaterial(texture: Texture): ShaderMaterial;
