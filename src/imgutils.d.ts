import type { Texture } from "three";
export type CanvasImage = Exclude<CanvasImageSource, SVGImageElement | VideoFrame>;
export declare function makeImageData(data: Uint8ClampedArray | Uint8Array | null, width: number, height: number): ImageData;
export declare function pixelsToImageFile(imgdata: ImageData, format: "png" | "webp", quality: number): Promise<Buffer<ArrayBufferLike>>;
export declare function fileToImageData(file: Uint8Array, mimetype: "image/png" | "image/jpg", stripAlpha: boolean): Promise<ImageData>;
export declare function pixelsToDataUrl(imgdata: ImageData): Promise<string>;
export declare function isImageEqual(overlay: ImageData, background: ImageData, x1?: number, y1?: number, width?: number, height?: number): boolean;
export declare function maskImage(img: ImageData, rects: {
    x: number;
    y: number;
    width: number;
    height: number;
}[]): void;
export declare function isImageEmpty(img: ImageData, mode: "black" | "transparent", x1?: number, y1?: number, width?: number, height?: number): boolean;
export declare function canvasToImageFile(cnv: HTMLCanvasElement, format: "png" | "webp", quality: number): Promise<Buffer<ArrayBuffer>>;
export declare function flipImage(img: ImageData): void;
export declare function sliceImage(img: ImageData, bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
}): ImageData;
export declare function findImageBounds(img: ImageData): {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function dumpTexture(img: ImageData | Texture | CanvasImage, flip?: boolean): HTMLCanvasElement;
export declare function drawTexture(ctx: CanvasRenderingContext2D, img: ImageData | Texture | CanvasImage): void;
