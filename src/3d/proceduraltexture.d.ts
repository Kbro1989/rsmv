import { Texture } from "../libs/proctexes";
import { EngineCache } from "./modeltothree";
declare class TextureGroup {
    textures: ImageData[];
    sprites: ImageData[];
    parent: Texture;
    filesize: number;
    getTexture(id: number): ImageData;
    getSprite(id: number): ImageData;
    constructor(tex: Texture);
    static create(engine: EngineCache, tex: Texture): Promise<TextureGroup>;
}
export declare function loadProcTexture(engine: EngineCache, id: number, size?: number, raw?: boolean): Promise<{
    img: ImageData;
    filesize: number;
    tex: Texture;
    deps: TextureGroup;
}>;
export declare function debugProcTexture(engine: EngineCache, id: number, size?: number): Promise<HTMLDivElement>;
export {};
