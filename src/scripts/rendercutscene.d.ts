import { CacheFileSource } from "../cache";
export declare function renderCutscene(engine: CacheFileSource, file: Buffer): Promise<{
    html: string;
    css: string;
    doc: string;
}>;
