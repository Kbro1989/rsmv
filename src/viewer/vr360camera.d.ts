import { BufferGeometry, Camera, CubeCamera, Mesh, RawShaderMaterial, WebGLCubeRenderTarget, WebGLRenderer } from "three";
declare class EquirectangularMaterial extends RawShaderMaterial {
    transparent: boolean;
    constructor();
}
export declare class VR360Render {
    cubeRenderTarget: WebGLCubeRenderTarget;
    cubeCamera: CubeCamera;
    skyCubeCamera: CubeCamera;
    quad: Mesh<BufferGeometry, EquirectangularMaterial>;
    projectCamera: Camera;
    size: number;
    constructor(parent: WebGLRenderer, size: number, near: number, far: number);
    render(renderer: WebGLRenderer): void;
}
export {};
