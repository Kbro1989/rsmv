import { TileGridSource, WorldLocation, MapRect } from "../3d/mapsquare";
import { EngineCache } from "../3d/modeltothree";
type Point = {
    x: number;
    z: number;
};
export declare function jsonIcons(engine: EngineCache, locs: WorldLocation[], rect: MapRect, maplevel: number): Promise<{
    src: string;
    width: number;
    height: number;
    uses: Point[];
    id: number;
}[]>;
export declare function svgfloor(engine: EngineCache, grid: TileGridSource, locs: WorldLocation[], rect: MapRect, maplevel: number, pxpertile: number, wallsonly: boolean, drawicons: boolean, thicklines?: boolean): Promise<string>;
export {};
