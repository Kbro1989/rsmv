import { CacheFileSource } from "../cache";
export type FontCharacterJson = {
    chr: string;
    charcode: number;
    x: number;
    y: number;
    width: number;
    height: number;
    bearingy: number;
    hash: number;
};
export type ParsedFontJson = {
    fontid: number;
    spriteid: number;
    characters: (FontCharacterJson | null)[];
    median: number;
    baseline: number;
    maxascent: number;
    maxdescent: number;
    scale: number;
    sheethash: number;
    sheetwidth: number;
    sheetheight: number;
    sheet: string;
};
export declare function loadFontMetrics(cache: CacheFileSource, buf: Buffer, fontid: number, withimage?: boolean): Promise<ParsedFontJson>;
export declare function measureFontText(font: ParsedFontJson, text: string): {
    width: number;
    height: number;
};
export declare function fontTextCanvas(font: ParsedFontJson, sheet: HTMLImageElement, text: string, scale: number): HTMLCanvasElement;
export declare function composeTexts(cnv: HTMLCanvasElement, color: string, shadow: boolean): HTMLCanvasElement;
