import * as THREE from "three";
import { TypedEmitter } from '../utils';
import { ModelExtras, ClickableMesh } from '../3d/mapsquare';
import { Camera, Mesh, Object3D, Vector3 } from "three";
import { VR360Render } from "./vr360camera";
import { UiCameraParams } from "./camerautils";
export type ThreeJsRendererEvents = {
    select: null | {
        obj: Mesh;
        meshdata: Extract<ModelExtras, ClickableMesh<any>>;
        match: unknown;
        vertexgroups: {
            start: number;
            end: number;
            mesh: THREE.Mesh;
        }[];
    };
};
export interface ThreeJsSceneElementSource {
    getSceneElements(): ThreeJsSceneElement | ThreeJsSceneElement[];
}
export type ThreeJsSceneElement = {
    modelnode?: Object3D;
    sky?: {
        skybox: THREE.Object3D | null;
        fogColor: number[];
    } | null;
    updateAnimation?: (delta: number, epochtime: number) => void;
    options?: {
        hideFloor?: boolean;
        hideFog?: boolean;
        camMode?: RenderCameraMode;
        camControls?: CameraControlMode;
        autoFrames?: AutoFrameMode | "auto";
        aspect?: number;
    };
};
type CameraControlMode = "free" | "world";
type AutoFrameMode = "forced" | "continuous" | "never";
export type RenderCameraMode = "standard" | "vr360" | "item" | "topdown";
export declare class ThreeJsRenderer extends TypedEmitter<ThreeJsRendererEvents> {
    private renderer;
    private canvas;
    private skybox;
    private scene;
    private modelnode;
    private floormesh;
    private queuedFrameId;
    private autoFrameMode;
    private contextLossCount;
    private contextLossCountLastRender;
    private clock;
    private sceneElements;
    private animationCallbacks;
    private vr360cam;
    private forceAspectRatio;
    private standardLights;
    private camMode;
    private camera;
    private topdowncam;
    private standardControls;
    private orthoControls;
    private itemcam;
    constructor(canvas: HTMLCanvasElement, params?: THREE.WebGLRendererParameters);
    getCurrent2dCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
    getStandardCamera(): THREE.PerspectiveCamera;
    getVr360Camera(): VR360Render;
    getItemCamera(): THREE.PerspectiveCamera;
    getTopdownCamera(): THREE.OrthographicCamera;
    getModelNode(): THREE.Group<THREE.Object3DEventMap>;
    addSceneElement(el: ThreeJsSceneElementSource): void;
    removeSceneElement(el: ThreeJsSceneElementSource): void;
    sceneElementsChanged(): void;
    resizeRendererToDisplaySize(): boolean | undefined;
    resizeViewToRendererSize(): void;
    guaranteeGlCalls: <T>(glfunction: () => T | Promise<T>) => Promise<T>;
    render: (cam?: THREE.Camera) => void;
    renderScene(cam: THREE.Camera): void;
    renderCube(render: VR360Render): void;
    forceFrame: () => void;
    takeScenePicture(width?: number, height?: number): Promise<ImageData>;
    getFrameBufferPixels(): ImageData;
    takeMapPicture(cam: Camera, framesizex?: number, framesizey?: number, linearcolor?: boolean, highlight?: Object3D | null): Promise<ImageData>;
    setCameraPosition(pos: Vector3): void;
    setCameraLimits(target?: Vector3): void;
    mousedown: (e: React.MouseEvent | MouseEvent) => Promise<void>;
    click(cnvx: number, cnvy: number): Promise<void>;
    makeUIRenderer(): {
        takePicture: (width: number, height: number, params: UiCameraParams) => ImageData;
        dispose: () => void | undefined;
        setmodel: (model: ThreeJsSceneElement | null, centery: number) => void;
    };
    dispose(): void;
}
export declare function disposeThreeTree(node: THREE.Object3D | null): void;
export declare function exportThreeJsGltf(node: THREE.Object3D): Promise<Buffer<ArrayBufferLike>>;
export declare function exportThreeJsStl(node: THREE.Object3D): Promise<Uint8Array<ArrayBufferLike>>;
export declare function highlightModelGroup(vertexgroups: {
    start: number;
    end: number;
    mesh: THREE.Mesh;
}[]): (() => void)[];
export {};
