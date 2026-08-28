import { AnimationClip, Object3D } from "three";
import { ThreejsSceneCache } from "./modeltothree";
export declare function mountSkeletalSkeleton(rootnode: Object3D, cache: ThreejsSceneCache, framebaseid: number): Promise<void>;
export declare function parseSkeletalAnimation(cache: ThreejsSceneCache, animid: number): Promise<{
    clip: AnimationClip;
    framebaseid: number;
}>;
