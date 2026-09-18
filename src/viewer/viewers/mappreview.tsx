import React from "react";
import { MapRect, rs2ChunkSize } from "../../3d/mapsquare";
import { EngineCache } from "../../3d/modeltothree";
import { UIEngineContext } from "../maincomponents";
import { cacheMajors } from "../../constants";
import { CacheIndexFile } from "../../cache";
import { packMapsquare, taskTrickler } from "../../utils";
import { TabStrip, useForceUpdate } from "../commoncontrols";
import { parse } from "../../parser/jsondecoders";
import { dumpTexture } from "../../imgutils";
import { Box2, Matrix3, Vector2 } from "three";

export type MapviewMarker = { x: number, z: number };

function rectToChunks(rect: MapRect, chunksize = rs2ChunkSize) {
    let chunksids: [number, number][] = [];
    for (let chunkx = Math.floor(rect.x / chunksize); chunkx < Math.ceil((rect.x + rect.xsize) / chunksize); chunkx++) {
        for (let chunkz = Math.floor(rect.z / chunksize); chunkz < Math.ceil((rect.z + rect.zsize) / chunksize); chunkz++) {
            chunksids.push([chunkx, chunkz]);
        }
    }
    return chunksids;
}


export async function renderMapPreview(engine: EngineCache, rect: MapRect, level = 0, scale = 1) {
    let img = new ImageData(rect.xsize * scale, rect.zsize * scale);

    let fillpixels: number[] = [];
    for (let dx = 0; dx < scale; dx++) {
        for (let dz = 0; dz < scale; dz++) {
            fillpixels.push(dx * 4 + dz * img.width * 4);
        }
    }
    let chunkids = rectToChunks(rect);


    let trickler = taskTrickler(16);
    let chunks = await Promise.all(chunkids.map(async q => trickler(() => engine.getObject("maptiles", q).catch(q => null))));

    for (let i = 0; i < chunks.length; i++) {
        let [chunkx, chunkz] = chunkids[i];
        let chunk = chunks[i];
        if (!chunk) continue;

        for (let z = 0; z < rs2ChunkSize; z++) {
            for (let x = 0; x < rs2ChunkSize; x++) {
                let tileindex = level * rs2ChunkSize * rs2ChunkSize + x * rs2ChunkSize + z;
                let tile = chunk.tiles[tileindex];
                if (!tile) { continue; }

                let pixelx = chunkx * rs2ChunkSize + x - rect.x;
                let pixelz = chunkz * rs2ChunkSize + z - rect.z;
                if (pixelx < 0 || pixelx >= rect.xsize || pixelz < 0 || pixelz >= rect.zsize) { continue; }
                let pixelindex = pixelz * img.width * 4 * scale + pixelx * 4 * scale;
                let didrender = false;
                if (tile.overlay !== null) {
                    let overlay = engine.mapOverlays[tile.overlay - 1];
                    let r = overlay?.color?.[0] ?? 0;
                    let g = overlay?.color?.[1] ?? 0;
                    let b = overlay?.color?.[2] ?? 0;
                    if (r == 255 && g == 0 && b == 255) {
                        // overlay is cutout, skip
                    } else {
                        didrender = true;
                        for (let fillindex of fillpixels) {
                            let finalindex = pixelindex + fillindex;
                            img.data[finalindex + 0] = r;
                            img.data[finalindex + 1] = g;
                            img.data[finalindex + 2] = b;
                            img.data[finalindex + 3] = 255;
                        }
                    }
                }
                if (!didrender && tile.underlay !== null) {
                    let underlay = engine.mapUnderlays[tile.underlay - 1];
                    let r = underlay?.color?.[0] ?? 0;
                    let g = underlay?.color?.[1] ?? 0;
                    let b = underlay?.color?.[2] ?? 0;
                    for (let fillindex of fillpixels) {
                        let finalindex = pixelindex + fillindex;
                        img.data[finalindex + 0] = r;
                        img.data[finalindex + 1] = g;
                        img.data[finalindex + 2] = b;
                        img.data[finalindex + 3] = 255;
                    }
                }
            }
        }
    }
    return img;
}

async function renderWorldMap42(engine: EngineCache, zoneid: number, scale = 4) {
    let arch = await engine.getArchiveById(cacheMajors.worldmaprender, zoneid);
    let mapfile = arch.find(q => q.fileid == 0);
    let labelfile = arch.find(q => q.fileid == 1);
    if (!mapfile) { throw new Error(`World map ${zoneid} has no map file`); }
    let map = parse.map41Sub0.read(mapfile.buffer, engine);
    let labels = labelfile && parse.maplabellocations.read(labelfile.buffer, engine);

    let palette: { colorhex: string }[] = [];
    palette.push(...map.underlays.map(q => {
        let underlay = engine.mapUnderlays[q - 1];
        return { colorhex: underlay?.color ? "#" + underlay.color.map(q => q.toString(16).padStart(2, "0")).join("") : "#000000" };
    }));
    palette.push(...map.overlays.map(q => {
        let overlay = engine.mapOverlays[q - 1];
        return { colorhex: overlay.color ? "#" + overlay.color.map(q => q.toString(16).padStart(2, "0")).join("") : "#000000" };
    }));

    let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
    for (let chunk of map.data) {
        minx = Math.min(minx, chunk.x * rs2ChunkSize + chunk.subx * chunk.chunksize);
        minz = Math.min(minz, chunk.z * rs2ChunkSize + chunk.subz * chunk.chunksize);
        maxx = Math.max(maxx, chunk.x * rs2ChunkSize + chunk.subx * chunk.chunksize + chunk.chunksize);
        maxz = Math.max(maxz, chunk.z * rs2ChunkSize + chunk.subz * chunk.chunksize + chunk.chunksize);
    }
    let maprect: MapRect = { x: minx, z: minz, xsize: maxx - minx, zsize: maxz - minz };
    let cnv = document.createElement("canvas");
    cnv.width = maprect.xsize * scale;
    cnv.height = maprect.zsize * scale;
    let ctx = cnv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.scale(scale, scale);
    for (let chunk of map.data) {
        for (let subx = 0; subx < chunk.chunksize; subx++) {
            let col = chunk.tiles[subx];
            for (let subz = 0; subz < chunk.chunksize; subz++) {
                let tile = col.v[subz].v;
                if (typeof tile != "number") { continue; }
                let imgx = chunk.x * rs2ChunkSize + chunk.subx * chunk.chunksize + subx - maprect.x;
                let imgz = chunk.z * rs2ChunkSize + chunk.subz * chunk.chunksize + subz - maprect.z;
                let paletteindex = tile >> 2;
                let colorhex = palette[paletteindex]?.colorhex ?? "#000000";
                ctx.fillStyle = colorhex;
                ctx.fillRect(imgx, imgz, 1, 1);
            }
        }
    }
    return dumpTexture(cnv);
}

globalThis.renderWorldMap42 = renderWorldMap42;

function chunkcachekey(x: number, z: number) {
    return (x << 16) | (z & 0xFFFF);
}

function simpleMapRenderer(engine: EngineCache | undefined, initialimgsource: "cache" | "runeapps", initialx?: number, initialz?: number, initialpxpertile?: number) {
    let chunkindex: CacheIndexFile | null = null;
    let layercaches = new Map<string, Map<number, CanvasImageSource | Promise<CanvasImageSource>>>();
    engine?.getCacheIndex(cacheMajors.mapsquares).then(q => {
        chunkindex = q;
        queuerender();
    });

    let setImgSource = (newsource: "cache" | "runeapps") => {
        res.imgsource = newsource;
        // chunkcache.clear();
        queuerender();
        res.onChange?.();
    }

    let scroll = (e: WheelEvent) => {
        let bound = res.cnv?.getBoundingClientRect();
        let mousepos = bound && pxtotile(e.clientX - bound!.left, e.clientY - bound!.top);
        res.pxpertile *= (1 - e.deltaY / 200);
        res.pxpertile = Math.max(1 / 16, Math.min(64, res.pxpertile));
        // compensate for zooming around the center
        if (mousepos && bound) {
            let newmousepos = bound && pxtotile(e.clientX - bound!.left, e.clientY - bound!.top)!;
            res.centerx += mousepos[0] - newmousepos[0];
            res.centerz += mousepos[1] - newmousepos[1];
        }
        queuerender();
    }

    let mousedown = (e: MouseEvent) => {
        let lastx = e.clientX;
        let lasty = e.clientY;
        let move = (e: MouseEvent) => {
            res.centerx -= (e.clientX - lastx) / res.pxpertile;
            res.centerz -= -(e.clientY - lasty) / res.pxpertile;
            lastx = e.clientX;
            lasty = e.clientY;
            queuerender();
        }
        let up = (e: MouseEvent) => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        }

        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    }

    let ref = (canvas: HTMLCanvasElement | null) => {
        if (!canvas) {
            res.cnv?.removeEventListener("mousedown", mousedown);
            res.cnv?.removeEventListener("wheel", scroll);
            res.cnv = null;
            res.ctx = null;
            return;
        }
        canvas.addEventListener("mousedown", mousedown);
        canvas.addEventListener("wheel", scroll);
        res.ctx = canvas.getContext("2d")!;
        res.cnv = canvas;
        queuerender();
    }

    let tiletopx = (tilex: number, tilez: number) => {
        let x = (tilex - res.centerx) * res.pxpertile + res.cnv!.width / 2;
        let z = -(tilez - res.centerz) * res.pxpertile + res.cnv!.height / 2;
        return [x, z];
    }
    let pxtotile = (x: number, y: number) => {
        if (!res.cnv) { return null; }
        let tilex = (x - res.cnv.width / 2) / res.pxpertile + res.centerx;
        let tilez = -(y - res.cnv.height / 2) / res.pxpertile + res.centerz;
        return [tilex, tilez];
    }


    let framereq = 0;
    let queuerender = () => {
        if (framereq) { return; }
        framereq = requestAnimationFrame(() => {
            framereq = 0;
            render();
        });
    }

    let tricklerender = taskTrickler(10);
    let render = () => {
        if (!res.cnv || !res.ctx || !engine) { return; }
        res.cnv.width = res.cnv.clientWidth;
        res.cnv.height = res.cnv.clientHeight;
        res.ctx.imageSmoothingEnabled = false;

        let toosmall = res.pxpertile < 0.9;

        let xsize = res.cnv.width / res.pxpertile;
        let zsize = res.cnv.height / res.pxpertile;
        let rect: MapRect = { x: res.centerx - xsize / 2, z: res.centerz - zsize / 2, xsize, zsize }

        let layername = "cache";
        let zoom = 1;
        let tiletoimgspace = new Matrix3();
        if (res.imgsource == "cache") {
            tiletoimgspace.makeScale(1 / rs2ChunkSize, 1 / rs2ChunkSize);
        }
        if (res.imgsource == "runeapps") {
            let runeappsmap = {
                maxzoom: 5,
                minzoom: -5,
                imgsize: 512,
            }
            zoom = Math.ceil(Math.log2(res.pxpertile));
            zoom = Math.max(runeappsmap.minzoom, Math.min(zoom, runeappsmap.maxzoom));
            layername = "runeapps-" + zoom;
            toosmall = false;

            let tilesperimg = runeappsmap.imgsize / Math.pow(2, zoom);
            tiletoimgspace.identity();
            // move origin to top left
            tiletoimgspace.premultiply(new Matrix3().makeTranslation(0, -200 * rs2ChunkSize));
            // add render offset (offset made the original render cheaper by reducing splillage)
            tiletoimgspace.premultiply(new Matrix3().makeTranslation(16, 16));
            // flip y-axis
            tiletoimgspace.premultiply(new Matrix3().makeScale(1, -1));
            // scale to chunk size 
            tiletoimgspace.premultiply(new Matrix3().makeScale(1 / tilesperimg, 1 / tilesperimg));
        }
        let chunkcache = layercaches.getOrInsertComputed(layername, () => new Map());
        let box = new Box2();
        box.expandByPoint(new Vector2(rect.x, rect.z).applyMatrix3(tiletoimgspace));
        box.expandByPoint(new Vector2(rect.x + rect.xsize, rect.z + rect.zsize).applyMatrix3(tiletoimgspace));
        let chunks = rectToChunks({
            x: box.min.x,
            z: box.min.y,
            xsize: box.max.x - box.min.x,
            zsize: box.max.y - box.min.y
        }, 1);
        let imgtotile = new Matrix3().copy(tiletoimgspace).invert();
        for (let [imgx, imgy] of chunks) {
            let key = chunkcachekey(imgx, imgy);
            if (res.imgsource == "cache") {
                if (imgx < 0 || imgy < 0 || imgx >= 100 * rs2ChunkSize || imgy >= 200 * rs2ChunkSize) {
                    continue;
                }
                if (!chunkindex?.[packMapsquare(imgx, imgy)]) {
                    continue; //doesn't exist
                }
            }
            let didrender = false;
            let chunkimg = chunkcache.get(key);
            if (!chunkimg && !toosmall) {
                chunkcache.set(key, tricklerender(async () => {
                    if (res.imgsource == "runeapps") {
                        let img = new Image();
                        img.src = `https://runeapps.org/s3/map4/live/topdown-0/${zoom}/${imgx}-${imgy}.webp`;
                        await img.decode().catch(e => { });
                        chunkcache.set(key, img);
                        if (res.imgsource == "runeapps") { queuerender(); }
                        return img;
                    } else if (res.imgsource == "cache") {
                        let img = await renderMapPreview(engine, { x: imgx * rs2ChunkSize, z: imgy * rs2ChunkSize, xsize: rs2ChunkSize, zsize: rs2ChunkSize }, 0, 1);
                        let bmp = await createImageBitmap(img, { imageOrientation: "flipY" });
                        chunkcache.set(key, bmp);
                        if (res.imgsource == "cache") { queuerender(); }
                        return bmp;
                    }
                    throw new Error(`Unknown imgsource ${res.imgsource}`);
                }));
            }
            let tilebox = new Box2();
            tilebox.expandByPoint(new Vector2(imgx, imgy).applyMatrix3(imgtotile));
            tilebox.expandByPoint(new Vector2(imgx + 1, imgy + 1).applyMatrix3(imgtotile));
            let [maxx, maxy] = tiletopx(tilebox.max.x, tilebox.min.y);
            let [minx, miny] = tiletopx(tilebox.min.x, tilebox.max.y);
            if (chunkimg instanceof ImageBitmap || chunkimg instanceof HTMLImageElement) {
                if (!(chunkimg instanceof HTMLImageElement) || chunkimg.naturalWidth > 0) {
                    res.ctx.drawImage(chunkimg, minx, miny, maxx - minx, maxy - miny);
                }
                didrender = true;
            }
            if (!didrender) {
                res.ctx.fillStyle = "rgba(160,160,160,1)";
                res.ctx.fillRect(minx, miny, maxx - minx, maxy - miny);
            }
        }
        res.ctx.strokeStyle = "rgba(255,255,255,0.5)";
        let [px, pz] = tiletopx(0, 0);
        res.ctx.strokeRect(px, pz, 100 * rs2ChunkSize * res.pxpertile, -200 * rs2ChunkSize * res.pxpertile);

        for (let marker of res.markers) {
            let [px, pz] = tiletopx(marker.x + 0.5, marker.z + 0.5);
            res.ctx.fillStyle = "rgba(255,0,0,1)";
            res.ctx.beginPath();
            res.ctx.moveTo(px, pz);
            res.ctx.arc(px, pz - 20, 10, Math.PI * 3 / 4, Math.PI * 1 / 4);
            res.ctx.closePath();
            res.ctx.fill();
            res.ctx.fillStyle = "rgba(255,255,255,1)";
            res.ctx.beginPath();
            res.ctx.ellipse(px, pz - 20, 6, 6, 0, 0, Math.PI * 2);
            res.ctx.fill();
            if (res.pxpertile > 4) {
                res.ctx.strokeRect(px - res.pxpertile / 2, pz - res.pxpertile / 2, res.pxpertile, res.pxpertile);
            }
        }
    }
    let res = {
        cnv: null as HTMLCanvasElement | null,
        ctx: null as CanvasRenderingContext2D | null,
        ref,
        render: queuerender,
        pxpertile: initialpxpertile ?? 2,
        centerx: initialx ?? 50 * rs2ChunkSize,
        centerz: initialz ?? 50 * rs2ChunkSize,
        imgsource: initialimgsource,
        setImgSource,
        onChange: null as (() => void) | null,
        markers: [] as MapviewMarker[],
    };

    globalThis.map = res;

    return res;
}

export function CheapMapView(p: { level?: number, centerx?: number, centerz?: number, pxpertile?: number, markers?: MapviewMarker[] }) {
    let ctx = React.useContext(UIEngineContext);
    let engine = ctx?.sceneCache.engine;


    let renderer = React.useMemo(() => simpleMapRenderer(engine, "cache", p.centerx, p.centerz, p.pxpertile), [engine]);
    renderer.onChange = useForceUpdate();

    renderer.markers = p.markers ?? [];

    return <div style={{ width: "100%", height: "100%", position: "absolute", overflow: "hidden" }}>
        <span style={{ position: "absolute", margin: "4px" }}>
            <TabStrip value={renderer.imgsource} tabs={{ cache: "Cache", runeapps: "RuneApps" }} onChange={renderer.setImgSource} />
        </span>
        <canvas className="mv-canvas" ref={renderer.ref} />
    </div>
}