import { PerspectiveCamera } from "three";
export type UiCameraParams = {
    rotx: number;
    roty: number;
    rotz: number;
    translatex: number;
    translatey: number;
    zoom: number;
};
export declare function updateItemCamera(cam: PerspectiveCamera, imgwidth: number, imgheight: number, centery: number, params: UiCameraParams): PerspectiveCamera;
