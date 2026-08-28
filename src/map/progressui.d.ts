import { MapRect } from "../3d/mapsquare";
type TileProgress = "queued" | "imaging" | "saving" | "done" | "skipped";
export type TileLoadState = "loading" | "loaded" | "unloaded";
export declare class ProgressUI {
    areas: MapRect[];
    tiles: Map<string, {
        el: HTMLDivElement;
        x: number;
        z: number;
        progress: TileProgress;
        loadstate: TileLoadState;
    }>;
    props: Record<string, {
        el: HTMLDivElement;
        contentel: HTMLElement;
        text: string;
    }>;
    root: HTMLElement;
    proproot: HTMLElement;
    grid: HTMLElement;
    private updateDebounce;
    private queuedUpdates;
    static renderBackgrounds: Record<TileLoadState, string>;
    static backgrounds: Record<TileProgress, string>;
    constructor();
    setAreas(areas: MapRect[]): void;
    update(x: number, z: number, state: TileProgress | "", tilestate?: TileLoadState | ""): void;
    private doupdate;
    updateProp(propname: string, value: string): void;
}
export {};
