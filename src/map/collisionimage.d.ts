import { MapRect, TileGridSource } from "../3d/mapsquare";
export declare function drawCollision(grids: TileGridSource[], rect: MapRect, maplevel: number, pxpertile: number, wallpx: number): Promise<Buffer<ArrayBuffer>>;
