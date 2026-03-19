"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkewOrthographicCamera = exports.MapRenderer = void 0;
exports.purgeBadRenders = purgeBadRenders;
exports.runMapRender = runMapRender;
exports.downloadMap = downloadMap;
exports.renderMapsquare = renderMapsquare;
exports.mapImageCamera = mapImageCamera;
const threejsrender_1 = require("../viewer/threejsrender");
const mapsquare_1 = require("../3d/mapsquare");
const svgrender_1 = require("./svgrender");
const constants_1 = require("../constants");
const opdecoder_1 = require("../opdecoder");
const imgutils_1 = require("../imgutils");
const modeltothree_1 = require("../3d/modeltothree");
const utils_1 = require("../utils");
const collisionimage_1 = require("./collisionimage");
const json_stringify_pretty_compact_1 = __importDefault(require("json-stringify-pretty-compact"));
const chunksummary_1 = require("./chunksummary");
const modelnodes_1 = require("../3d/modelnodes");
const zlib = __importStar(require("zlib"));
const three_1 = require("three");
const progressui_1 = require("./progressui");
const mipper_1 = require("./mipper");
const crc32util_1 = require("../libs/crc32util");
async function getVersionsFile(config, includeCacheVersion = null) {
    //make sure versions file is updated
    let versionsres = await config.getFileResponse("versions.json", 0);
    let mapversionsinfo;
    if (!versionsres.ok) {
        mapversionsinfo = {
            versions: []
        };
    }
    else {
        mapversionsinfo = await versionsres.json();
    }
    if (includeCacheVersion && !mapversionsinfo.versions.some(q => q.version == config.version)) {
        mapversionsinfo.versions.push({
            version: config.version,
            build: includeCacheVersion.getBuildNr(),
            date: +includeCacheVersion.getCacheMeta().timestamp,
            source: includeCacheVersion.getCacheMeta().name
        });
        mapversionsinfo.versions.sort((a, b) => b.version - a.version);
        //no lock this is technically a race condition when using multiple renderers
        console.log("updating versions file");
        await config.saveFile("versions.json", 0, Buffer.from(JSON.stringify(mapversionsinfo)), 0);
    }
    return mapversionsinfo;
}
async function purgeBadRenders(config, versionfilter) {
    let timestamp = new Date().toISOString();
    let versions = await getVersionsFile(config);
    for (let version of versions.versions) {
        if (typeof versionfilter.from == "number" && version.version < versionfilter.from) {
            continue;
        }
        if (typeof versionfilter.to == "number" && version.version > versionfilter.to) {
            continue;
        }
        let configres = await config.getFileResponse("meta.json", version.version);
        if (!configres.ok) {
            console.log("missing meta.json file skipped");
            continue;
        }
        let metajson = await configres.json();
        metajson.workerid = config.workerid;
        metajson.running = true;
        metajson.rendertimestamp = timestamp;
        await config.saveFile("meta.json", 0, Buffer.from(JSON.stringify(metajson, undefined, "\t")));
    }
}
async function mapAreaPreset(filesource, areaArgument) {
    let areas = [];
    let mask = undefined;
    if (areaArgument == "" || areaArgument == "full") {
        areas = [{ x: 0, z: 0, xsize: 100, zsize: 200 }];
    }
    else if (areaArgument.match(/^\w+$/)) {
        if (areaArgument == "main") {
            //enums 708 seems to be the map select dropdown in-game
            let file = await filesource.getFileById(constants_1.cacheMajors.enums, 708);
            let mapenum = opdecoder_1.parse.enums.read(file, filesource);
            let files = await filesource.getArchiveById(constants_1.cacheMajors.worldmap, 0);
            mask = mapenum.intArrayValue2.values
                .map(q => opdecoder_1.parse.mapZones.read(files[q[1]].buffer, filesource))
                // .filter(q => q.show && q.name)
                .flatMap(q => q.bounds)
                .map(q => {
                let x = q.src.xstart;
                let z = q.src.zstart;
                //add +1 since the zones are inclusive of their end coord
                return { x, z, xsize: q.src.xend - x + 1, zsize: q.src.zend - z + 1 };
            });
            //hardcoded extra bits
            mask.push({ x: 2176, z: 3456, xsize: 64, zsize: 64 }); //prif top ocean doesn't exist on any map
            mask.push({ x: 2432, z: 2624, xsize: 128, zsize: 128 }); //use the original ashdale and hope for the best
            //hardcoded areas that aren't on any normal map
            mask.push({ x: 59 * 64, z: 109 * 64, xsize: 128, zsize: 128 }); //telos
            mask.push({ x: 47 * 64, z: 93 * 64, xsize: 2 * 64, zsize: 4 * 64 }); //vorago
            mask.push({ x: 14 * 64, z: 4 * 64, xsize: 3 * 64, zsize: 4 * 64 }); //zuk
            mask.push({ x: 23 * 64, z: 24 * 64, xsize: 4 * 64, zsize: 4 * 64 }); //zamorak
            mask.push({ x: 70 * 64, z: 140 * 64, xsize: 5 * 64, zsize: 5 * 64 }); //ed1
            mask.push({ x: 76 * 64, z: 140 * 64, xsize: 5 * 64, zsize: 5 * 64 }); //ed2
            mask.push({ x: 82 * 64, z: 140 * 64, xsize: 5 * 64, zsize: 5 * 64 }); //ed3
            mask.push({ x: 69 * 64, z: 96 * 64, xsize: 6 * 64, zsize: 4 * 64 }); //araxxor
            mask.push({ x: 5 * 64, z: 2 * 64, xsize: 1 * 64, zsize: 1 * 64 }); //kerapac
            mask.push({ x: 43 * 64, z: 27 * 64, xsize: 3 * 64, zsize: 3 * 64 }); //aod
            mask.push({ x: 50 * 64, z: 158 * 64, xsize: 2 * 64, zsize: 1 * 64 }); //wars retreat
            areas = mask.map(q => {
                let x = Math.floor(q.x / 64);
                let z = Math.floor(q.z / 64);
                return { x, z, xsize: Math.ceil((q.x + q.xsize) / 64) - x + 1, zsize: Math.ceil((q.z + q.zsize) / 64) - z + 1 };
            });
        }
        if (areaArgument == "test") {
            areas = [
                { x: 49, z: 49, xsize: 3, zsize: 3 }
            ];
        }
    }
    else {
        let fileranges = (0, utils_1.stringToFileRange)(areaArgument);
        if (!fileranges || fileranges.length == 0) {
            throw new Error("map area argument did not match a preset name and did not resolve to a rectangle");
        }
        areas = fileranges.map(r => ({ x: r.start[0], z: r.start[1], xsize: r.end[0] - r.start[0] + 1, zsize: r.end[1] - r.start[1] + 1 }));
    }
    if (areas.length == 0) {
        throw new Error("no map area or map name");
    }
    return { areas, mask };
}
async function runMapRender(output, filesource, config, forceCheck) {
    let versionid = filesource.getBuildNr();
    if (filesource.getBuildNr() > 900) {
        //use build number for older caches since they wont have version timestamps
        //for newer caches the timestamp is more reliable since it allows us to mix
        //openrs2 and sqlite caches at will without 100% knowing the build number
        //and newer game updates rarely update build nr
        //do a quick search of common cache indices
        let maxtime = 0;
        for (let major of [constants_1.cacheMajors.mapsquares, constants_1.cacheMajors.items, constants_1.cacheMajors.npcs, constants_1.cacheMajors.objects, constants_1.cacheMajors.config]) {
            let index = await filesource.getCacheIndex(major);
            for (let entry of index) {
                if (entry && entry.version > maxtime) {
                    maxtime = entry.version;
                }
            }
        }
        versionid = maxtime;
    }
    await config.beginMapVersion(versionid);
    if (!forceCheck) {
        let prevconfigreq = await config.getFileResponse("meta.json");
        if (!prevconfigreq.ok) {
            console.log(`starting new render ${config.version}`);
        }
        else {
            let prevconfig = await prevconfigreq.json();
            let prevdate = new Date(prevconfig.rendertimestamp);
            let isownrun = prevconfig.workerid == config.workerid;
            let hoursold = (Date.now() - +prevdate) / 1000 / 60 / 60;
            //take work from other worker if the timestamp is older than 20 hours which probably means something crashed
            if (prevconfig.running && isownrun) {
                console.log(`continuing render ${config.version} which was locked by current worker`);
            }
            else if (prevconfig.running && hoursold > 20) {
                console.log(`continuing render ${config.version} which was locked by other worker and presumed abandoned. (locked ${hoursold | 0} hours ago)`);
            }
            else {
                output.log("skipping", config.version);
                return () => { };
            }
        }
    }
    let engine = await modeltothree_1.EngineCache.create(filesource);
    let progress = new progressui_1.ProgressUI();
    progress.updateProp("source", filesource.getCacheMeta().name + "\n" + filesource.getCacheMeta().descr);
    let cleanup = () => progress.root.remove();
    output.setUI(progress.root);
    let { areas, mask } = await mapAreaPreset(filesource, config.config.area);
    progress.setAreas(areas);
    progress.updateProp("deps", "starting dependency graph");
    try {
        let deparea = undefined;
        if (areas.length == 1) {
            deparea = { x: areas[0].x - 2, z: areas[0].z - 2, xsize: areas[0].xsize + 2, zsize: areas[0].zsize + 2 };
        }
        var deps = await engine.getDependencyGraph();
        await deps.preloadChunkDependencies({ area: deparea });
    }
    catch (e) {
        console.error(e);
        progress.updateProp("deps", "starting dependency graph");
        return cleanup;
    }
    progress.updateProp("deps", `completed, ${deps.dependencyMap.size} nodes`);
    // progress.updateProp("version", new Date(deps.maxVersion * 1000).toUTCString());
    let opts = { mask };
    if (config.config.layers.some(q => q.mode == "minimap")) {
        opts.minimap = true;
    }
    if (config.config.layers.some(q => q.mode == "collision")) {
        opts.collision = true;
    }
    opts = modelnodes_1.RSMapChunk.defaultopts(opts);
    let getRenderer = () => {
        let cnv = document.createElement("canvas");
        let renderer = new MapRenderer(cnv, config, engine, deps, opts);
        renderer.loadcallback = (x, z, state) => progress.update(x, z, "", state);
        return renderer;
    };
    await downloadMap(output, getRenderer, engine, deps, areas, config, progress);
    output.log("done");
    return cleanup;
}
class MapRenderer {
    renderer;
    engine;
    config;
    scenecache = null;
    maxunused = 11;
    minunused = 8;
    idcounter = 0;
    squares = [];
    deps;
    loadcallback = null;
    opts;
    constructor(cnv, config, engine, deps, opts) {
        this.engine = engine;
        this.opts = opts;
        this.deps = deps;
        this.config = config;
        this.renderer = new threejsrender_1.ThreeJsRenderer(cnv, { alpha: false });
        //TODO turn opaquebackground back on for map renders
        this.renderer.addSceneElement({ getSceneElements() { return { options: { autoFrames: "never", hideFog: true } }; } });
        cnv.addEventListener("webglcontextlost", async () => {
            let isrestored = await new Promise((done, err) => {
                let cleanup = (v) => {
                    cnv.removeEventListener("webglcontextrestored", handler);
                    clearTimeout(timer);
                    done(v);
                };
                let handler = () => cleanup(true);
                cnv.addEventListener("webglcontextrestored", handler);
                let timer = setTimeout(cleanup, 10 * 1000, false);
            });
            console.log(`context restore detection ${isrestored ? "restored before trigger" : "triggered and focusing window"}`);
            if (!isrestored) {
                // electron.remote.getCurrentWebContents().focus();
            }
        });
    }
    async getChunk(x, z, needsmodels) {
        let square = this.squares.find(q => q.x == x && q.z == z);
        if (square && (!needsmodels || square.model)) {
            return square;
        }
        else {
            this.loadcallback?.(x, z, "loading");
            if (!this.scenecache) {
                console.log("refreshing scenecache");
                this.scenecache = await modeltothree_1.ThreejsSceneCache.create(this.engine);
            }
            if (!square) {
                let parseprom = (0, mapsquare_1.parseMapsquare)(this.scenecache.engine, x, z, this.opts);
                let id = this.idcounter++;
                square = {
                    id,
                    x: x,
                    z: z,
                    parseprom: parseprom,
                    model: null,
                    loaded: null,
                    loadprom: null,
                };
                this.squares.push(square);
            }
            if (needsmodels) {
                square.model = new modelnodes_1.RSMapChunk(this.scenecache, square.parseprom, x, z, this.opts);
                square.loadprom = (async () => {
                    let chunkdata = await square.model.chunkdata;
                    square.loaded = {
                        rendermeta: {
                            x: chunkdata.chunkx,
                            z: chunkdata.chunkz,
                            version: this.config.version,
                            floor: (!chunkdata.chunk ? [] : (0, chunksummary_1.mapsquareFloorDependencies)(chunkdata.grid, this.deps, chunkdata.chunk)),
                            locs: (0, chunksummary_1.mapsquareLocDependencies)(chunkdata.grid, this.deps, chunkdata.modeldata, chunkdata.chunkx, chunkdata.chunkz)
                        },
                        grid: chunkdata.grid,
                        chunkdata: chunkdata
                    };
                    this.loadcallback?.(x, z, "loaded");
                    return square.loaded;
                })();
            }
            return square;
        }
    }
    async setArea(x, z, xsize, zsize, needsmodels) {
        let load = [];
        //load topright last to increase chance of cache hit later on
        for (let dx = 0; dx < xsize; dx++) {
            for (let dz = 0; dz < zsize; dz++) {
                load.push(await this.getChunk(x + dx, z + dz, needsmodels));
            }
        }
        await Promise.all(load.map(q => q.loadprom));
        load.forEach(q => q.model?.addToScene(this.renderer));
        let obsolete = this.squares.filter(square => !load.includes(square));
        if (obsolete.length >= this.maxunused) {
            obsolete.sort((a, b) => b.id - a.id);
            let removed = obsolete.slice(this.minunused);
            removed.forEach(r => {
                r.model?.cleanup();
                this.loadcallback?.(r.x, r.z, "unloaded");
            });
            this.squares = this.squares.filter(sq => !removed.includes(sq));
        }
        return load;
    }
}
exports.MapRenderer = MapRenderer;
async function downloadMap(output, getRenderer, engine, deps, rects, config, progress) {
    let errs = [];
    const zscan = 4;
    const maxretries = 1;
    let chunks = [];
    for (let rect of rects) {
        for (let z = rect.z; z < rect.z + rect.zsize; z++) {
            for (let x = rect.x; x < rect.x + rect.xsize; x++) {
                chunks.push({ x, z });
            }
        }
    }
    //sort in zigzag pattern in order to do nearby chunks while neighbours are still in mem
    const sortedstride = config.config.mapsizex * zscan;
    chunks.sort((a, b) => {
        let aa = a.x * zscan + Math.floor(a.z / zscan) * sortedstride + a.z % sortedstride;
        let bb = b.x * zscan + Math.floor(b.z / zscan) * sortedstride + b.z % sortedstride;
        return aa - bb;
    });
    //now that it's sorted its cheap to remove dupes
    let prefilterlen = chunks.length;
    chunks = chunks.filter((v, i, arr) => (i == 0 || v.x != arr[i - 1].x || v.z != arr[i - 1].z));
    output.log("filtered out dupes", prefilterlen - chunks.length);
    let configjson = {
        buildnr: engine.getBuildNr(),
        timestamp: (isNaN(+engine.getCacheMeta().timestamp) ? "" : engine.getCacheMeta().timestamp.toISOString()),
        areas: rects,
        version: config.version,
        errorcount: 0,
        running: true,
        workerid: config.workerid,
        rendertimestamp: new Date().toISOString()
    };
    await config.saveFile("meta.json", 0, Buffer.from(JSON.stringify(configjson, undefined, "\t")));
    let versionsFile = await getVersionsFile(config, engine);
    let mipper = new mipper_1.MipScheduler(config, progress);
    let depstracker = new chunksummary_1.RenderDepsTracker(engine, config, deps, versionsFile);
    let maprender = null;
    let activerender = Promise.resolve();
    let render = function* () {
        let completed = 0;
        for (let chunk of chunks) {
            if (output.state != "running") {
                break;
            }
            let task = renderMapsquare(engine, config, depstracker, mipper, progress, chunk.x, chunk.z);
            let lastrender = activerender;
            let fn = (async () => {
                if (output.state != "running") {
                    return;
                }
                for (let retry = 0; retry <= maxretries; retry++) {
                    try {
                        let renderprom = lastrender.then(() => maprender ??= getRenderer());
                        let res = await task.runTasks(renderprom);
                        break;
                    }
                    catch (e) {
                        console.warn(e.toString());
                        errs.push(e.toString());
                        maprender = null;
                        e = null; //e references the complete stack
                        //new stack frame
                        await (0, utils_1.delay)(1);
                        //force garbage collection if exposed in nodejs/electron flags
                        globalThis.gc?.();
                    }
                }
            })();
            //chain onto previous to retain order on the renderer
            activerender = activerender.then(() => fn);
            yield fn;
            completed++;
            if (completed % 20 == 0) {
                yield mipper.run();
            }
        }
    };
    await (0, utils_1.trickleTasks)("", 10, render);
    await mipper.run(true);
    configjson.errorcount = errs.length;
    configjson.running = false;
    await config.saveFile("meta.json", 0, Buffer.from(JSON.stringify(configjson, undefined, "\t")));
    output.log(errs);
}
function getLayerZooms(config, layercnf) {
    const min = Math.floor(Math.log2(config.tileimgsize / (Math.max(config.mapsizex, config.mapsizez) * 64)));
    const max = Math.log2(layercnf.pxpersquare);
    const base = Math.log2(config.tileimgsize / 64);
    return { min, max, base };
}
function setChunkRenderToggles(chunks, floornr, isminimap, hidelocs) {
    let toggles = {};
    for (let i = 0; i < 4; i++) {
        toggles["floor" + i] = !isminimap && i <= floornr;
        toggles["objects" + i] = !hidelocs && !isminimap && i <= floornr;
        toggles["mini_floor" + i] = isminimap && i <= floornr;
        toggles["mini_objects" + i] = !hidelocs && isminimap && i <= floornr;
        toggles["walkmesh" + i] = false;
        toggles["map" + i] = false;
        toggles["mapscenes" + i] = false;
        toggles["walls" + i] = false;
        toggles["floorhidden" + i] = false;
        toggles["collision" + i] = false;
        toggles["collision-raw" + i] = false;
    }
    for (let chunk of chunks) {
        chunk.model?.setToggles(toggles);
    }
}
class SimpleHasher {
    depstracker;
    subhashes = [];
    constructor(deps) {
        this.depstracker = deps;
    }
    getsubhash(x, z) {
        let h = this.subhashes.find(q => q.x == x && q.z == z);
        if (!h) {
            let hash = this.depstracker.deps.hashDependencies(this.depstracker.deps.makeDeptName("mapsquare", x + z * mapsquare_1.worldStride));
            this.subhashes.push({ x, z, hash });
            return hash;
        }
        else {
            return h.hash;
        }
    }
    recthash(rect) {
        let hash = 0;
        for (let z = rect.z; z < rect.z + rect.zsize; z++) {
            for (let x = rect.x; x < rect.x + rect.xsize; x++) {
                hash = (0, crc32util_1.crc32addInt)(this.getsubhash(x, z), hash);
            }
        }
        return hash;
    }
    rectexists(rect) {
        let exists = false;
        for (let z = rect.z; z < rect.z + rect.zsize; z++) {
            for (let x = rect.x; x < rect.x + rect.xsize; x++) {
                exists ||= this.depstracker.deps.hasEntry("mapsquare", x + z * mapsquare_1.worldStride);
            }
        }
        return exists;
    }
}
function chunkrectToOffetWorldRect(engine, config, rect) {
    const chunksize = (engine.classicData ? mapsquare_1.classicChunkSize : mapsquare_1.rs2ChunkSize);
    const offset = (config.config.nochunkoffset ? 0 : Math.round(chunksize / 4));
    let worldrect = {
        x: rect.x * chunksize - offset,
        z: rect.z * chunksize - offset,
        xsize: chunksize * rect.xsize,
        zsize: chunksize * rect.zsize
    };
    let loadedchunksrect = {
        x: rect.x - 1,
        z: rect.z - 1,
        xsize: rect.xsize + (config.config.nochunkoffset ? 2 : 1),
        zsize: rect.zsize + (config.config.nochunkoffset ? 2 : 1)
    };
    return { worldrect, loadedchunksrect };
}
function renderMapsquare(engine, config, depstracker, mipper, progress, chunkx, chunkz) {
    let baseoutputx = chunkx;
    let baseoutputy = (config.config.noyflip ? chunkz : config.config.mapsizez - 1 - chunkz);
    let filebasecoord = { x: baseoutputx, y: baseoutputy };
    progress.update(chunkx, chunkz, "imaging");
    let deps = new SimpleHasher(depstracker);
    let chunktasks = [];
    let miptasks = [];
    for (let cnf of config.config.layers) {
        let squares = 1; //cnf.mapsquares ?? 1;//TODO remove or reimplement
        if (chunkx % squares != 0 || chunkz % squares != 0) {
            continue;
        }
        let singlerect = { x: chunkx, z: chunkz, xsize: squares, zsize: squares };
        let modefunc = rendermodes[cnf.mode];
        if (!modefunc) {
            throw new Error("unknown render mode");
        }
        chunktasks.push(...modefunc(engine, config, cnf, deps, filebasecoord, singlerect));
    }
    let runTasks = async (renderpromise) => {
        let savetasks = [];
        let symlinkcommands = [];
        let nonemptytasks = chunktasks.filter(q => deps.rectexists(q.datarect));
        let metas = await config.getMetas(nonemptytasks.filter(q => q.hash != 0));
        let allparentcandidates = new Set();
        for (let task of nonemptytasks) {
            let existingfile = metas.find(q => q.file == task.name && q.hash == task.hash);
            if (!existingfile) {
                task.dedupeDependencies?.forEach(q => allparentcandidates.add(q));
            }
        }
        let parentinfo = await depstracker.forkDeps([...allparentcandidates]);
        let renderer = null;
        for (let task of nonemptytasks) {
            let existingfile = metas.find(q => q.file == task.name && q.hash == task.hash);
            if (!existingfile) {
                if (!renderer) {
                    renderer = await renderpromise;
                }
                let skipmodels = !task.run;
                let chunks = await renderer.setArea(task.datarect.x, task.datarect.z, task.datarect.xsize, task.datarect.zsize, !skipmodels);
                let parsedchunks = await Promise.all(chunks.map(q => q.parseprom));
                //no actual chunks loaded, this shouldn't happen (not often) because we filter existing rects before
                if (!parsedchunks.some(q => q.chunk)) {
                    continue;
                }
                //run the render task
                let data;
                if (task.run) {
                    await Promise.all(chunks.map(q => q.loadprom));
                    data = await task.run(chunks, renderer, parentinfo);
                }
                else if (task.run2d) {
                    data = await task.run2d(parsedchunks);
                }
                else {
                    throw new Error("task has no run and also no run2d method");
                }
                //store it
                if (data.symlink) {
                    existingfile = data.symlink;
                }
                else if (data.file) {
                    savetasks.push(data.file().then(buf => config.saveFile(task.name, task.hash, buf)));
                }
            }
            if (existingfile) {
                symlinkcommands.push({ file: task.name, hash: task.hash, buildnr: config.version, symlink: existingfile.file, symlinkbuildnr: existingfile.buildnr, symlinkfirstbuildnr: existingfile.firstbuildnr });
            }
            if (task.mippable) {
                miptasks.push(() => {
                    let mip = task.mippable;
                    mipper.addTask(task.layer, mip.zoom, task.hash, mip.outputx, mip.outputy, task.name, existingfile?.fshash ?? task.hash);
                });
            }
        }
        progress.update(chunkx, chunkz, "done");
        await Promise.all(savetasks);
        await config.symlinkBatch(symlinkcommands);
        miptasks.forEach(q => q());
        progress.update(chunkx, chunkz, (savetasks.length == 0 ? "skipped" : "done"));
        let localsymlinkcount = symlinkcommands.filter(q => q.symlinkbuildnr == config.version && q.file != q.symlink).length;
        console.log("imaged", chunkx, chunkz, "files", savetasks.length, "symlinks", localsymlinkcount, "(unchanged)", symlinkcommands.length - localsymlinkcount);
    };
    //TODO returning a promise just gets flattened with our currnet async execution
    return { runTasks };
}
const rendermodeInteractions = function (engine, config, cnf, deps, baseoutput, singlerect) {
    let thiscnf = cnf;
    let filename = `${thiscnf.name}/${singlerect.x}-${singlerect.z}.${cnf.usegzip ? "json.gz" : "json"}`;
    return [{
            layer: thiscnf,
            name: filename,
            hash: deps.recthash(singlerect),
            datarect: singlerect,
            async run(chunks, renderer) {
                let loaded = chunks[0].loaded.chunkdata;
                if (!loaded) {
                    throw new Error("unexpected");
                }
                let rect = { x: singlerect.x * loaded.chunkSize, z: singlerect.z * loaded.chunkSize, xsize: loaded.chunkSize, zsize: loaded.chunkSize };
                let { hashes, locdatas, locs } = (0, chunksummary_1.chunkSummary)(loaded.grid, loaded.modeldata, rect);
                let emptyimagecount = 0;
                let hashimgs = {};
                for (let [hash, { center, locdata }] of hashes) {
                    let ops = [locdata.location.actions_0, locdata.location.actions_1, locdata.location.actions_2, locdata.location.actions_3, locdata.location.actions_4].filter((q) => !!q);
                    let model = loaded.locRenders.get(locdata);
                    if (!model) {
                        continue;
                    }
                    // if (ops.length == 0) { continue; }
                    setChunkRenderToggles(chunks, locdata.plane, false, true);
                    let sections = model.map(q => q.mesh.cloneSection(q));
                    model.map(q => q.mesh.setSectionHide(q, true));
                    let group = new three_1.Object3D();
                    group.add(...sections.map(q => q.mesh));
                    group.traverse(q => q.layers.set(1));
                    loaded.chunkroot.add(group);
                    let ntiles = 16;
                    let baseheight = (0, mapsquare_1.getTileHeight)(loaded.grid, locdata.x, locdata.z, locdata.plane);
                    let ypos = baseheight / mapsquare_1.tiledimensions + center[1];
                    let cam = mapImageCamera(locdata.x + center[0] + ypos * thiscnf.dxdy - ntiles / 2, locdata.z + center[2] + ypos * thiscnf.dzdy - ntiles / 2, ntiles, thiscnf.dxdy, thiscnf.dzdy);
                    let img = await renderer.renderer.takeMapPicture(cam, ntiles * thiscnf.pxpersquare, ntiles * thiscnf.pxpersquare, false, group);
                    group.removeFromParent();
                    model.map(q => q.mesh.setSectionHide(q, false));
                    let bounds = (0, imgutils_1.findImageBounds)(img);
                    if (bounds.width == 0 || bounds.height == 0) {
                        emptyimagecount++;
                        continue;
                    }
                    let format = thiscnf.format ?? "webp";
                    let subimg = (0, imgutils_1.sliceImage)(img, bounds);
                    let imgfile = await (0, imgutils_1.pixelsToImageFile)(subimg, format, 0.9);
                    hashimgs[hash] = {
                        loc: locdata.locid,
                        dx: bounds.x - img.width / 2,
                        dy: bounds.y - img.height / 2,
                        w: bounds.width,
                        h: bounds.height,
                        center,
                        img: `data:image/${format};base64,${imgfile.toString("base64")}`
                    };
                }
                let textual = (0, json_stringify_pretty_compact_1.default)({ locs, locdatas, rect, hashimgs, pxpertile: thiscnf.pxpersquare, dxdy: thiscnf.dxdy, dzdy: thiscnf.dzdy }, { indent: "\t" });
                let buf = Buffer.from(textual, "utf8");
                if (thiscnf.usegzip) {
                    buf = zlib.gzipSync(buf);
                }
                return { file: () => Promise.resolve(buf) };
            }
        }];
};
const rendermode3d = function (engine, config, cnf, hasher, baseoutput, maprect) {
    let zooms = getLayerZooms(config.config, cnf);
    let { loadedchunksrect, worldrect } = chunkrectToOffetWorldRect(engine, config, maprect);
    let thiscnf = cnf;
    let tasks = [];
    let overlayimg = null;
    for (let zoom = zooms.base; zoom <= zooms.max; zoom++) {
        let subslices = 1 << (zoom - zooms.base);
        let pxpersquare = thiscnf.pxpersquare >> (zooms.max - zoom);
        let tiles = worldrect.xsize / subslices;
        for (let subx = 0; subx < subslices; subx++) {
            for (let subz = 0; subz < subslices; subz++) {
                let suby = (config.config.noyflip ? subz : subslices - 1 - subz);
                let filename = config.makeFileName(thiscnf.name, zoom, baseoutput.x * subslices + subx, baseoutput.y * subslices + suby, cnf.format ?? "webp");
                let parentCandidates = [
                    { name: filename, level: thiscnf.level }
                ];
                for (let sub of thiscnf.subtractlayers ?? []) {
                    let other = config.config.layers.find(q => q.name == sub);
                    if (!other) {
                        console.warn("subtrack layer " + sub + "missing");
                        continue;
                    }
                    parentCandidates.push({
                        name: config.makeFileName(other.name, zoom, baseoutput.x * subslices + subx, baseoutput.y * subslices + suby, cnf.format ?? "webp"),
                        level: other.level
                    });
                }
                let depcrc = hasher.recthash(loadedchunksrect);
                tasks.push({
                    layer: thiscnf,
                    name: filename,
                    hash: depcrc,
                    datarect: loadedchunksrect,
                    dedupeDependencies: parentCandidates.map(q => q.name),
                    mippable: (zoom == zooms.base ? { outputx: baseoutput.x, outputy: baseoutput.y, zoom: zoom } : null),
                    async run(chunks, renderer, parentinfo) {
                        setChunkRenderToggles(chunks, thiscnf.level, thiscnf.mode == "minimap", !!thiscnf.hidelocs);
                        let cam = mapImageCamera(worldrect.x + tiles * subx, worldrect.z + tiles * subz, tiles, thiscnf.dxdy, thiscnf.dzdy);
                        let parentFile = undefined;
                        // svg overlay to draw walls/icons need to be rendered for this chunk
                        if (!overlayimg && (thiscnf.overlayicons || thiscnf.overlaywalls)) {
                            if (thiscnf.overlayicons && !thiscnf.overlaywalls) {
                                //need to refarctor svgfloor a bit for this to work without breaking other stuff
                                throw new Error("overlayicons without overlaywalls currently not supported");
                            }
                            let grid = new mapsquare_1.CombinedTileGrid(chunks.map(ch => ({
                                src: ch.loaded.grid,
                                rect: {
                                    x: ch.model.chunkx * ch.loaded.chunkdata.chunkSize,
                                    z: ch.model.chunkz * ch.loaded.chunkdata.chunkSize,
                                    xsize: ch.loaded.chunkdata.chunkSize,
                                    zsize: ch.loaded.chunkdata.chunkSize,
                                }
                            })));
                            let locs = chunks.flatMap(ch => ch.model.loaded.chunk?.locs ?? []);
                            let svg = await (0, svgrender_1.svgfloor)(engine, grid, locs, worldrect, thiscnf.level, thiscnf.pxpersquare, !!thiscnf.overlaywalls, !!thiscnf.overlayicons, true);
                            overlayimg = new Image();
                            overlayimg.src = `data:image/svg+xml;base64,${btoa(svg)}`;
                            await overlayimg.decode();
                        }
                        findparent: for (let parentoption of parentCandidates) {
                            for (let versionMatch of await parentinfo.findMatches(this.datarect, parentoption.name)) {
                                let isdirty = false;
                                for (let chunk of chunks) {
                                    let other = versionMatch.metas.find(q => q.x == chunk.x && q.z == chunk.z);
                                    if (!other) {
                                        throw new Error("unexpected");
                                    }
                                    chunk.model.rootnode.updateWorldMatrix(true, false);
                                    let modelmatrix = new three_1.Matrix4().makeTranslation(chunk.model.chunkx * mapsquare_1.tiledimensions * chunk.model.loaded.chunkSize, 0, chunk.model.chunkz * mapsquare_1.tiledimensions * chunk.model.loaded.chunkSize).premultiply(chunk.model.rootnode.matrixWorld);
                                    let proj = cam.projectionMatrix.clone()
                                        .multiply(cam.matrixWorldInverse)
                                        .multiply(modelmatrix);
                                    let locs = (0, chunksummary_1.compareLocDependencies)(chunk.loaded.rendermeta.locs, other.locs, thiscnf.level, parentoption.level);
                                    let floor = (0, chunksummary_1.compareFloorDependencies)(chunk.loaded.rendermeta.floor, other.floor, thiscnf.level, parentoption.level);
                                    // if (locs.length + floor.length > 400) {
                                    // 	continue optloop;
                                    // }
                                    isdirty ||= (0, chunksummary_1.pointsIntersectProjection)(proj, locs);
                                    isdirty ||= (0, chunksummary_1.pointsIntersectProjection)(proj, floor);
                                    if (isdirty) {
                                        break;
                                    }
                                }
                                // let area = diff.coverage();
                                if (!isdirty) {
                                    parentFile = versionMatch.file;
                                    break findparent;
                                }
                                // if (area < 0.2) {
                                // 	if (area > 0) {
                                // 		let { rects } = diff.calculateDiffArea(img.width, img.height);
                                // 		maskImage(img, rects);
                                // 	}
                                // 	break;
                                // }
                            }
                        }
                        if (parentFile) {
                            return {
                                file: undefined,
                                symlink: parentFile
                            };
                        }
                        let img = await renderer.renderer.takeMapPicture(cam, tiles * pxpersquare, tiles * pxpersquare, thiscnf.mode == "minimap");
                        // isImageEmpty(img, "black");
                        //keep reference to dedupe similar renders
                        chunks.forEach(chunk => parentinfo.addLocalSquare(chunk.loaded.rendermeta));
                        parentinfo.addLocalFile({
                            file: this.name,
                            fshash: depcrc,
                            buildnr: config.version,
                            firstbuildnr: config.version,
                            hash: depcrc,
                            time: Date.now()
                        });
                        if (overlayimg) {
                            let mergecnv = document.createElement("canvas");
                            mergecnv.width = img.width;
                            mergecnv.height = img.height;
                            let ctx = mergecnv.getContext("2d");
                            ctx.putImageData(img, 0, 0);
                            ctx.drawImage(overlayimg, overlayimg.width * subx / subslices, overlayimg.height * (subslices - 1 - subz) / subslices, overlayimg.width / subslices, overlayimg.height / subslices, 0, 0, img.width, img.height);
                            return {
                                file: (() => (0, imgutils_1.canvasToImageFile)(mergecnv, thiscnf.format ?? "webp", 0.9)),
                                symlink: parentFile
                            };
                        }
                        else {
                            return {
                                file: (() => (0, imgutils_1.pixelsToImageFile)(img, thiscnf.format ?? "webp", 0.9)),
                                symlink: parentFile
                            };
                        }
                    }
                });
            }
        }
    }
    return tasks;
};
const rendermodeMap = function (engine, config, cnf, deps, baseoutput, maprect) {
    let zooms = getLayerZooms(config.config, cnf);
    let { loadedchunksrect, worldrect } = chunkrectToOffetWorldRect(engine, config, maprect);
    let thiscnf = cnf;
    let filename = config.makeFileName(thiscnf.name, zooms.base, baseoutput.x, baseoutput.y, "svg");
    let depcrc = deps.recthash(loadedchunksrect);
    return [{
            layer: thiscnf,
            name: filename,
            hash: depcrc,
            datarect: loadedchunksrect,
            mippable: { outputx: baseoutput.x, outputy: baseoutput.y, zoom: zooms.base },
            async run2d(parsedata) {
                let grid = new mapsquare_1.CombinedTileGrid(parsedata.map(pp => ({
                    src: pp.grid,
                    rect: {
                        x: pp.chunkx * pp.chunkSize,
                        z: pp.chunkz * pp.chunkSize,
                        xsize: pp.chunkSize,
                        zsize: pp.chunkSize,
                    }
                })));
                let locs = parsedata.flatMap(ch => ch.chunk?.locs ?? []);
                let svg = await (0, svgrender_1.svgfloor)(engine, grid, locs, worldrect, thiscnf.level, thiscnf.pxpersquare, !!thiscnf.wallsonly, !!thiscnf.mapicons, !!thiscnf.thicklines);
                return {
                    file: () => Promise.resolve(Buffer.from(svg, "utf8"))
                };
            }
        }];
};
const rendermodeCollision = function (engine, config, cnf, deps, baseoutput, maprect) {
    let zooms = getLayerZooms(config.config, cnf);
    let { loadedchunksrect, worldrect } = chunkrectToOffetWorldRect(engine, config, maprect);
    let thiscnf = cnf;
    let filename = config.makeFileName(thiscnf.name, zooms.base, baseoutput.x, baseoutput.y, cnf.format ?? "webp");
    let depcrc = deps.recthash(loadedchunksrect);
    return [{
            layer: thiscnf,
            name: filename,
            hash: depcrc,
            datarect: loadedchunksrect,
            mippable: { outputx: baseoutput.x, outputy: baseoutput.y, zoom: zooms.base },
            async run2d(chunks) {
                //TODO try enable 2d map render without loading all the 3d stuff
                let grids = chunks.map(q => q.grid);
                let file = (0, collisionimage_1.drawCollision)(grids, worldrect, thiscnf.level, thiscnf.pxpersquare, 1);
                return { file: () => file };
            }
        }];
};
const rendermodeHeight = function (engine, config, cnf, deps, baseoutput, singlerect) {
    let thiscnf = cnf;
    let filename = `${thiscnf.name}/${singlerect.x}-${singlerect.z}.${cnf.usegzip ? "bin.gz" : "bin"}`;
    return [{
            layer: thiscnf,
            name: filename,
            hash: deps.recthash(singlerect),
            datarect: singlerect,
            async run2d(chunks) {
                //TODO what to do with classic 48x48 chunks?
                let file = chunks[0].grid.getHeightCollisionFile(singlerect.x * 64, singlerect.z * 64, thiscnf.level, 64, 64, cnf.allcorners ?? false);
                let buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
                if (thiscnf.usegzip) {
                    buf = zlib.gzipSync(buf);
                }
                return { file: () => Promise.resolve(buf) };
            }
        }];
};
const rendermodeLocs = function (engine, config, cnf, deps, baseoutput, singlerect) {
    let thiscnf = cnf;
    let filename = `${thiscnf.name}/${singlerect.x}-${singlerect.z}.${cnf.usegzip ? "json.gz" : "json"}`;
    return [{
            layer: thiscnf,
            name: filename,
            hash: deps.recthash(singlerect),
            datarect: singlerect,
            async run(chunks) {
                let { grid, modeldata, chunkSize } = chunks[0].loaded.chunkdata;
                let rect = { x: singlerect.x * chunkSize, z: singlerect.z * chunkSize, xsize: chunkSize, zsize: chunkSize };
                let { locdatas, locs } = (0, chunksummary_1.chunkSummary)(grid, modeldata, rect);
                let textual = (0, json_stringify_pretty_compact_1.default)({ locdatas, locs, rect }, { indent: "\t" });
                let buf = Buffer.from(textual, "utf8");
                if (thiscnf.usegzip) {
                    buf = zlib.gzipSync(buf);
                }
                return { file: () => Promise.resolve(buf) };
            }
        }];
};
const rendermodeMaplabels = function (engine, config, cnf, deps, baseoutput, singlerect) {
    let thiscnf = cnf;
    let filename = `${thiscnf.name}/${singlerect.x}-${singlerect.z}.${cnf.usegzip ? "json.gz" : "json"}`;
    return [{
            layer: thiscnf,
            name: filename,
            hash: deps.recthash(singlerect),
            datarect: singlerect,
            async run2d(chunks) {
                let chunkSize = chunks[0].chunkSize;
                let rawarea = { x: singlerect.x * chunkSize, z: singlerect.z * chunkSize, xsize: chunkSize, zsize: chunkSize };
                let locs = chunks.flatMap(ch => ch.chunk?.locs ?? []);
                let iconjson = await (0, svgrender_1.jsonIcons)(engine, locs, rawarea, thiscnf.level);
                let textual = (0, json_stringify_pretty_compact_1.default)(iconjson, { indent: "\t" });
                let buf = Buffer.from(textual, "utf8");
                if (thiscnf.usegzip) {
                    buf = zlib.gzipSync(buf);
                }
                return { file: () => Promise.resolve(buf) };
            }
        }];
};
const rendermodeRenderMeta = function (engine, config, cnf, deps, baseoutput, singlerect) {
    let thiscnf = cnf;
    let filename = `${thiscnf.name}/${singlerect.x}-${singlerect.z}.${cnf.usegzip ? "json.gz" : "json"}`;
    return [{
            layer: thiscnf,
            name: filename,
            hash: deps.recthash(singlerect),
            datarect: singlerect,
            async run(chunks) {
                let obj = chunks[0].loaded.rendermeta;
                let file = Buffer.from(JSON.stringify(obj), "utf8");
                if (thiscnf.usegzip) {
                    file = zlib.gzipSync(file);
                }
                return { file: () => Promise.resolve(file) };
            }
        }];
};
const rendermodes = {
    "3d": rendermode3d,
    minimap: rendermode3d,
    interactions: rendermodeInteractions,
    collision: rendermodeCollision,
    map: rendermodeMap,
    height: rendermodeHeight,
    locs: rendermodeLocs,
    maplabels: rendermodeMaplabels,
    rendermeta: rendermodeRenderMeta
};
//TODO test map generation and move it over to mapimagecamera2
function mapImageCamera(x, z, ntiles, dxdy, dzdy) {
    let scale = 2 / ntiles;
    let cam = new three_1.Camera();
    cam.projectionMatrix.elements = [
        scale, scale * dxdy, 0, -x * scale - 1,
        0, scale * dzdy, -scale, -z * scale - 1,
        0, -0.01, 0, 0,
        0, 0, 0, 1
    ];
    // cam.projectionMatrix.scale(new Vector3(1, -1, 1));
    cam.projectionMatrix.transpose();
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    return cam;
}
// export function mapImageCamera2(x: number, z: number, ntiles: number, dxdy: number, dzdy: number) {
// 	let cam = new SkewOrthographicCamera(ntiles, dxdy, dzdy);
// 	cam.pointDown();
// 	//negative z since the camera is usually in threejs reference frame instead of the flipped rs reference frame
// 	cam.position.set(x + ntiles / 2, 0, -(z + ntiles / 2));
// 	return cam;
// }
class SkewOrthographicCamera extends three_1.OrthographicCamera {
    skewMatrix = new three_1.Matrix4();
    constructor(ntiles, dxdy, dzdy) {
        super(-ntiles / 2, ntiles / 2, ntiles / 2, -ntiles / 2, -500, 500);
        this.setSkew(dxdy, dzdy);
    }
    pointDown() {
        this.quaternion.setFromUnitVectors(new three_1.Vector3(0, 0, 1), new three_1.Vector3(0, 1, 0));
    }
    setSkew(dxdz, dydz) {
        this.skewMatrix.set(1, 0, dxdz, 0, 0, 1, dydz, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        this.updateProjectionMatrix();
    }
    updateProjectionMatrix() {
        //null during super constructor...
        if (this.skewMatrix) {
            super.updateProjectionMatrix();
            this.projectionMatrix.multiply(this.skewMatrix);
            this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
        }
    }
}
exports.SkewOrthographicCamera = SkewOrthographicCamera;
