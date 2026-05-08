import * as THREE from "three";
import { ThreejsSceneCache } from '../3d/modeltothree';
import { ModelModifications, TypedEmitter, CallbackPromise } from '../utils';
import { MapRect, ParsemapOpts, RSMapChunkData, WorldLocation, ThreeJsRenderSection, parseMapsquare } from '../3d/mapsquare';
import { AnimationClip, Object3D, SkeletonHelper, Texture, Vector2 } from "three";
import { ModelData } from "../3d/rt7model";
import { ThreeJsRenderer, ThreeJsSceneElement, ThreeJsSceneElementSource } from "../viewer/threejsrender";
import { animgroupconfigs } from "../../generated/animgroupconfigs";
import { MaterialData } from "./jmat";
export type SimpleModelDef = {
    modelid: number;
    mods: ModelModifications;
}[];
export type SimpleModelInfo<T = object, ID = string> = {
    models: SimpleModelDef;
    anims: Record<string, number>;
    info: T;
    id: ID;
    name: string;
};
export declare function castModelInfo<T, ID>(info: SimpleModelInfo<T, ID>): SimpleModelInfo<T, ID>;
export declare function modelToModel(cache: ThreejsSceneCache, id: number): Promise<SimpleModelInfo<{
    modeldata: ModelData;
    info: any;
}, number>>;
export declare function playerDataToModel(cache: ThreejsSceneCache, modeldata: {
    player: string;
    head: boolean;
    data: Buffer;
}): Promise<SimpleModelInfo<{
    avatar: import("../../generated/avataroverrides").avataroverrides | null;
    gender: number;
    npc: import("../../generated/npcs").npcs | null;
    kitcolors: Record<"hair" | "feet" | "skin" | "clothes", Record<number, number>>;
    buffer: Buffer<ArrayBufferLike>;
}, {
    player: string;
    head: boolean;
    data: Buffer;
}>>;
export declare function playerToModel(cache: ThreejsSceneCache, name: string): Promise<SimpleModelInfo<{
    avatar: import("../../generated/avataroverrides").avataroverrides | null;
    gender: number;
    npc: import("../../generated/npcs").npcs | null;
    kitcolors: Record<"hair" | "feet" | "skin" | "clothes", Record<number, number>>;
    buffer: Buffer<ArrayBufferLike>;
}, string>>;
export declare function npcBodyToModel(cache: ThreejsSceneCache, id: number): Promise<SimpleModelInfo<import("../../generated/npcs").npcs, {
    id: number;
    head: boolean;
}>>;
export declare function npcToModel(cache: ThreejsSceneCache, id: {
    id: number;
    head: boolean;
}): Promise<SimpleModelInfo<import("../../generated/npcs").npcs, {
    id: number;
    head: boolean;
}>>;
export declare function spotAnimToModel(cache: ThreejsSceneCache, id: number): Promise<SimpleModelInfo<import("../../generated/spotanims").spotanims, number>>;
export declare function locToModel(cache: ThreejsSceneCache, id: number): Promise<SimpleModelInfo<import("../../generated/objects").objects, number>>;
export declare function itemToModel(cache: ThreejsSceneCache, id: number): Promise<SimpleModelInfo<import("../../generated/items").items, number>>;
export declare function materialToModel(sceneCache: ThreejsSceneCache, id: number): Promise<SimpleModelInfo<{
    texs: Record<string, {
        texid: number;
        filesize: number;
        img0: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;
    }>;
    obj: MaterialData;
}, number>>;
export declare class RSModel extends TypedEmitter<{
    loaded: undefined;
    animchanged: number;
}> implements ThreeJsSceneElementSource {
    model: Promise<{
        modeldata: ModelData;
        mesh: Object3D;
        nullAnim: AnimationClip;
    }>;
    loaded: {
        modeldata: ModelData;
        mesh: Object3D;
        nullAnim: AnimationClip;
        matUvAnims: {
            tex: Texture;
            v: Vector2;
        }[];
    } | null;
    cache: ThreejsSceneCache;
    rootnode: THREE.Group<THREE.Object3DEventMap>;
    nullAnimPromise: {
        clip: AnimationClip | null;
        prom: CallbackPromise<THREE.AnimationClip>;
    };
    anims: Record<number, {
        clip: AnimationClip | null;
        prom: Promise<AnimationClip>;
    }>;
    mountedanim: AnimationClip | null;
    mixer: THREE.AnimationMixer;
    renderscene: ThreeJsRenderer | null;
    targetAnimId: number;
    skeletontype: "none" | "baked" | "full";
    skeletonHelper: SkeletonHelper | null;
    cleanup(): void;
    getSceneElements(): ThreeJsSceneElement;
    addToScene(scene: ThreeJsRenderer): void;
    onModelLoaded: () => void;
    updateAnimation: (delta: number, epochtime: number) => void;
    constructor(cache: ThreejsSceneCache, models: SimpleModelDef, name?: string);
    private mountAnim;
    loadAnimation(animid: number): {
        clip: AnimationClip | null;
        prom: Promise<AnimationClip>;
    };
    setAnimation(animid: number): Promise<void>;
}
export declare class RSMapChunkGroup extends TypedEmitter<{
    loaded: undefined;
    changed: undefined;
}> implements ThreeJsSceneElementSource {
    chunks: RSMapChunk[];
    rootnode: THREE.Group<THREE.Object3DEventMap>;
    renderscene: ThreeJsRenderer | null;
    mixer: THREE.AnimationMixer;
    getSceneElements(): ThreeJsSceneElement[];
    addToScene(scene: ThreeJsRenderer): void;
    cleanup(): void;
    constructor(cache: ThreejsSceneCache, rect: MapRect, extraopts?: ParsemapOpts);
}
export declare class RSMapChunk extends TypedEmitter<{
    loaded: RSMapChunkData;
    changed: undefined;
}> implements ThreeJsSceneElementSource {
    chunkdata: Promise<RSMapChunkData>;
    loaded: RSMapChunkData | null;
    cache: ThreejsSceneCache;
    rootnode: THREE.Group<THREE.Object3DEventMap>;
    mixer: THREE.AnimationMixer;
    renderscene: ThreeJsRenderer | null;
    toggles: Record<string, boolean>;
    chunkx: number;
    chunkz: number;
    globalname: string;
    constructor(cache: ThreejsSceneCache, preparsed: ReturnType<typeof parseMapsquare>, chunkx: number, chunkz: number, opts: ParsemapOpts);
    static defaultopts(extraopts?: ParsemapOpts): ParsemapOpts;
    static create(cache: ThreejsSceneCache, chunkx: number, chunkz: number, extraopts?: ParsemapOpts): RSMapChunk;
    testLocImg(loc: WorldLocation): Promise<ImageData>;
    cloneLocModel(entry: ThreeJsRenderSection[]): ThreeJsRenderSection[];
    replaceLocModel(loc: WorldLocation, newmodels?: ThreeJsRenderSection[]): ThreeJsRenderSection[];
    cleanup(): void;
    renderSvg(level?: number, wallsonly?: boolean, pxpersquare?: number): Promise<string>;
    getSceneElements(): ThreeJsSceneElement;
    addToScene(scene: ThreeJsRenderer): void;
    onModelLoaded(): void;
    setToggles(toggles: Record<string, boolean>, hideall?: boolean): void;
}
export declare function serializeAnimset(group: animgroupconfigs): Record<string, number>;
