import { LayerConfig } from ".";
import { MapRender } from "./backends";
import { ProgressUI } from "./progressui";
type MipFile = {
    name: string;
    hash: number;
    fshash: number;
};
type MipCommand = {
    layer: LayerConfig;
    zoom: number;
    x: number;
    y: number;
    files: (MipFile | null)[];
};
export declare class MipScheduler {
    render: MapRender;
    progress: ProgressUI;
    incompletes: Map<string, MipCommand>;
    minzoom: number;
    constructor(render: MapRender, progress: ProgressUI);
    addTask(layer: LayerConfig, zoom: number, hash: number, x: number, y: number, srcfile: string, fshash: number): void;
    run(includeIncomplete?: boolean): Promise<number>;
}
export {};
