import { mapsquare_underlays } from "../../generated/mapsquare_underlays";
import { objects } from "../../generated/objects";
import { MapRect, TileGrid } from "../3d/mapsquare";
import { EngineCache } from "./modeltothree";
export declare function getClassicMapData(engine: EngineCache, rs2x: number, rs2z: number): Promise<{
    rect: MapRect;
    mapfilehash: number;
    tiles: ({
        flags: number;
        shape: number | null;
        overlay: number | null;
        settings: number | null;
        underlay: number | null;
        height: (number | number) | null;
    } | {
        flags: number;
        shape: number | null;
        overlay: number | null;
        settings: number | null;
        underlay: number | null;
        height: number | null;
    })[];
    locs: {
        id: number;
        uses: {
            y: number;
            x: number;
            plane: number;
            rotation: number;
            type: number;
            extra: {
                flags: number;
                rotation: number[] | null;
                translateX: number | null;
                translateY: number | null;
                translateZ: number | null;
                scale: number | null;
                scaleX: number | null;
                scaleY: number | null;
                scaleZ: number | null;
            } | null;
        }[];
    }[];
    levels: number;
} | null>;
export declare function classicModifyTileGrid(grid: TileGrid): void;
export declare function classicDecodeMaterialInt(int: number): {
    color: [number, number, number];
    colorint: number;
    material: number;
    invisible: boolean;
};
export declare function getClassicLoc(engine: EngineCache, id: number): objects;
export declare function classicIntsToModelMods(...matints: number[]): objects;
export declare function classicOverlays(engine: EngineCache): Promise<{
    color: number[];
    material: number;
}[]>;
export declare function classicUnderlays(): mapsquare_underlays[];
