export type SubImageData = {
    x: number;
    y: number;
    fullwidth: number;
    fullheight: number;
    img: ImageData;
};
export declare function parseSubsprite(buf: Buffer, palette: Buffer, width: number, height: number, alpha: boolean, transposed: boolean): {
    img: ImageData;
    bytesused: number;
};
export declare function parseLegacySprite(metafile: Buffer, buf: Buffer): SubImageData;
export declare function expandSprite(subimg: SubImageData): ImageData;
export declare function parseSprite(buf: Buffer): SubImageData[];
export declare function parseTgaSprite(file: Buffer): SubImageData;
export declare function spriteHash(img: ImageData): number;
