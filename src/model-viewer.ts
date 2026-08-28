import { EngineCache, ThreejsSceneCache } from "./3d/modeltothree";
import { CallbackCacheLoader } from "./cache/index";

export class WebCacheSource extends CallbackCacheLoader {
    constructor(url: string) {
        super(async (maj, min) => {
            const resp = await fetch(`${url}/${maj}/${min}`);
            return Buffer.from(await resp.arrayBuffer()) as any;
        }, false);
    }
}

export async function loadModel(modelId: number) {
    // Reference loader for remote cross-referencing
    const source = new WebCacheSource("https://runeapps.org/624-927");
    const engine = await EngineCache.create(source);
    const scene = await ThreejsSceneCache.create(engine);
    const model = await scene.getModelData(modelId);
    return model;
}
