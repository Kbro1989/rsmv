"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawCollision = drawCollision;
const imgutils_1 = require("../imgutils");
const mapsquare_1 = require("../3d/mapsquare");
function drawCollision(grids, rect, maplevel, pxpertile, wallpx) {
    let cnv = document.createElement("canvas");
    let ctx = cnv.getContext("2d", { willReadFrequently: true });
    cnv.width = rect.xsize * pxpertile;
    cnv.height = rect.zsize * pxpertile;
    ctx.scale(1, -1);
    ctx.translate(0, -rect.zsize * pxpertile);
    ctx.translate(-rect.x * pxpertile, -rect.z * pxpertile);
    let wallcol = "red";
    let walkcol = "orange";
    let colcheck = (tiles, index, lowx, lowz, highx, highz) => {
        let walk = false;
        let sight = false;
        for (let tile of tiles) {
            walk ||= !!tile.effectiveCollision && tile.effectiveCollision.walk[index];
            sight ||= !!tile.effectiveCollision && tile.effectiveCollision.sight[index];
        }
        if (walk) {
            ctx.fillStyle = (sight ? wallcol : walkcol);
            ctx.fillRect(tiles[0].x / mapsquare_1.tiledimensions * pxpertile + (lowx ? 0 : pxpertile - wallpx), tiles[0].z / mapsquare_1.tiledimensions * pxpertile + (lowz ? 0 : pxpertile - wallpx), (lowx && highx ? pxpertile : wallpx), (lowz && highz ? pxpertile : wallpx));
        }
    };
    for (let z = rect.z; z < rect.z + rect.zsize; z++) {
        for (let x = rect.x; x < rect.x + rect.xsize; x++) {
            //some collision might spill over from neighbouring chunks
            //check for the tile on every grid and OR them together
            let tiles = [];
            for (let grid of grids) {
                let tile = grid.getTile(x, z, maplevel);
                if (tile) {
                    tiles.push(tile);
                }
            }
            if (tiles.length == 0) {
                continue;
            }
            //center
            colcheck(tiles, 0, true, true, true, true);
            //walls
            colcheck(tiles, 1, true, true, false, true);
            colcheck(tiles, 2, true, false, true, true);
            colcheck(tiles, 3, false, true, true, true);
            colcheck(tiles, 4, true, true, true, false);
            //corners
            colcheck(tiles, 5, true, false, false, true);
            colcheck(tiles, 6, false, false, true, true);
            colcheck(tiles, 7, false, true, true, false);
            colcheck(tiles, 8, true, true, false, false);
        }
    }
    return (0, imgutils_1.canvasToImageFile)(cnv, "png", 1);
}
