export declare class ParsedTexture {
    imagefiles: Buffer[];
    stripAlpha: boolean;
    isMaterialTexture: boolean;
    type: "png" | "dds" | "bmpmips" | "ktx" | "imagedata";
    mipmaps: number;
    cachedDrawables: (Promise<HTMLImageElement | ImageBitmap> | null)[];
    cachedImageDatas: (Promise<ImageData> | null)[];
    bmpWidth: number;
    bmpHeight: number;
    filesize: number;
    constructor(texture: Buffer | ImageData, stripAlpha: boolean, isMaterialTexture?: boolean);
    toImageData(subimg?: number): Promise<ImageData>;
    toWebgl(subimg?: number): Promise<HTMLImageElement | ImageBitmap>;
}
