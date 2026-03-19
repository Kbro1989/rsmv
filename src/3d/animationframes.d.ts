import { AnimationClip, AnimationMixer, Bone, Object3D, Skeleton } from "three";
import { framemaps } from "../../generated/framemaps";
import { ThreejsSceneCache } from "./modeltothree";
import { sequences } from "../../generated/sequences";
import { frames } from "../../generated/frames";
import { ModelData } from "./rt7model";
export type MountableAnimation = {
    skeleton: Skeleton;
    clip: AnimationClip;
    rootbones: Bone[];
};
export declare function mountBakedSkeleton(rootnode: Object3D, model: ModelData): {
    mixer: AnimationMixer;
};
export declare function parseAnimationSequence4(loader: ThreejsSceneCache, sequenceframes: NonNullable<sequences["frames"]>): Promise<(model: ModelData) => AnimationClip>;
export declare function getFrameClips(framebase: framemaps, framesparsed: frames[]): Float32Array<ArrayBufferLike>[];
