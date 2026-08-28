import { interfaces } from "../../generated/interfaces";
import { ThreejsSceneCache } from "../3d/modeltothree";
import { CacheFileSource } from "../cache";
import { ClientScriptInterpreter } from "../clientscript/interpreter";
import { TypedEmitter } from "../utils";
import { ThreeJsRenderer } from "../viewer/threejsrender";
export declare const MAGIC_CONST_MOUSE_X: number;
export declare const MAGIC_CONST_MOUSE_Y: number;
export declare const MAGIC_CONST_CURRENTCOMP: number;
export declare const MAGIC_CONST_OPNR: number;
export declare const MAGIC_CONST_IF_AS_CC: number;
export declare const MAGIC_UNK06: number;
type HTMLResult = string;
export type RsInterfaceDomTree = {
    el: HTMLDivElement;
    container: HTMLDivElement;
    rootcomps: RsInterfaceComponent[];
    interfaceid: number;
    loadprom: Promise<void>;
    dispose: () => void;
};
export declare class UiRenderContext extends TypedEmitter<{
    hover: RsInterfaceComponent | null;
    select: RsInterfaceComponent | null;
}> {
    source: CacheFileSource;
    sceneCache: ThreejsSceneCache | null;
    renderer: ThreeJsRenderer | null;
    comps: Map<number, RsInterfaceComponent>;
    highlightstack: HTMLElement[];
    interpreterprom: Promise<ClientScriptInterpreter> | null;
    touchedComps: Set<RsInterfaceComponent>;
    runOnloadScripts: boolean;
    constructor(source: CacheFileSource);
    toggleHighLightComp(subid: number, highlight: boolean): void;
    runClientScriptCallback(compid: number, cbdata: (number | string)[]): Promise<void>;
    updateInvalidatedComps(): void;
}
export declare function loadRsInterfaceData(ctx: UiRenderContext, id: number): Promise<{
    comps: Map<number, RsInterfaceComponent>;
    rootcomps: RsInterfaceComponent[];
    basewidth: number;
    baseheight: number;
    id: number;
}>;
export declare function renderRsInterfaceHTML(ctx: UiRenderContext, id: number): Promise<HTMLResult>;
export declare function renderRsInterfaceDOM(ctx: UiRenderContext, data: Awaited<ReturnType<typeof loadRsInterfaceData>>): RsInterfaceDomTree;
declare function uiModelRenderer(renderer: ThreeJsRenderer, sceneCache: ThreejsSceneCache, camdata: (interfaces["modeldata"] & {})["positiondata"] & {}): {
    dispose: () => void;
    canvas: HTMLCanvasElement;
    setmodel: (modelid: number) => void;
    setanim: (animid: number) => void;
};
export type RsInterFaceTypes = "text" | "sprite" | "container" | "model" | "figure";
export type TypedRsInterFaceComponent<T extends RsInterFaceTypes | "any"> = RsInterfaceComponent & {
    data: {
        containerdata: T extends "container" ? {} : unknown;
        spritedata: T extends "sprite" ? {} : unknown;
        textdata: T extends "text" ? {} : unknown;
        modeldata: T extends "model" ? {} : unknown;
        figuredata: T extends "figure" ? {} : unknown;
    };
};
export declare class RsInterfaceComponent {
    ctx: UiRenderContext;
    data: interfaces;
    parent: RsInterfaceComponent | null;
    children: RsInterfaceComponent[];
    clientChildren: RsInterfaceComponent[];
    compid: number;
    modelrenderer: ReturnType<typeof uiModelRenderer> | null;
    spriteChild: HTMLDivElement | null;
    textChild: HTMLSpanElement | null;
    loadingSprite: number;
    element: HTMLElement | null;
    api: CS2Api;
    constructor(ctx: UiRenderContext, interfacedata: interfaces, compid: number);
    isCompType<T extends RsInterFaceTypes>(type: T): this is TypedRsInterFaceComponent<T>;
    toHtml(ctx: UiRenderContext): Promise<any>;
    dispose(): void;
    initDom(): HTMLElement;
    updateDom(): void;
    getStyle(): {
        title: string;
        style: string;
    };
}
export declare class CS2Api {
    data: interfaces | null;
    comp: RsInterfaceComponent | null;
    constructor(comp: RsInterfaceComponent | null);
    changed(): void;
    findChild(ccid: number): CS2Api | undefined;
    getNextChildId(): number;
    createChild(ccid: number, type: number): CS2Api;
    setSize(w: number, h: number, modew: number, modeh: number): void;
    setPosition(x: number, y: number, modex: number, modey: number): void;
    setHide(hide: number): void;
    setWidth(w: number): void;
    setHeight(h: number): void;
    setX(x: number): void;
    setY(y: number): void;
    getHide(): number;
    getWidth(): number;
    getHeight(): number;
    getX(): number;
    getY(): number;
    setOp(index: number, text: string): void;
    getOp(index: number): string;
    setText(text: string): void;
    getText(): string;
    setTextAlign(a: number, b: number, c: number): void;
    getTextAlign(): number[];
    getGraphic(): number;
    getHFlip(): boolean;
    getVFlip(): boolean;
    getTiling(): number;
    getRotation(): number;
    setGraphic(sprite: number): void;
    setHFlip(flip: boolean): void;
    setVFlip(flip: boolean): void;
    setTiling(tiling: number): void;
    setRotation(rot: number): void;
    setModel(id: number): void;
    getModel(): number;
    getTrans(): number;
    setTrans(trans: number): void;
    getFilled(): number;
    setFilled(filled: number): void;
    getColor(): number;
    setColor(col: number): void;
}
export {};
