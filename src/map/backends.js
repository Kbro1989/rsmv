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
Object.defineProperty(exports, "__esModule", { value: true });
exports.examplemapconfig = exports.MapRenderDatabaseBacked = exports.MapRenderFsBacked = exports.MapRender = void 0;
exports.parseMapConfig = parseMapConfig;
const utils_1 = require("../utils");
const scriptrunner_1 = require("../scriptrunner");
const jsonschemas_1 = require("../jsonschemas");
const commentjson = __importStar(require("comment-json"));
function parseMapConfig(configfile) {
    let layerconfig = commentjson.parse(configfile);
    delete layerconfig.$schema; //for some reason jsonschema has special (incorrect) behavior for this
    (0, jsonschemas_1.assertSchema)(layerconfig, jsonschemas_1.maprenderConfigSchema);
    return layerconfig;
}
class MapRender {
    config;
    version = 0;
    workerid = "default";
    constructor(config) {
        this.config = config;
    }
    async symlinkBatch(files) {
        await Promise.all(files.map(f => this.symlink(f.file, f.hash, f.symlink, f.symlinkbuildnr)));
    }
    async beginMapVersion(version) {
        this.version = version;
    }
    //optional api's when rendering history stuff
    rendermetaLayer = undefined;
    async getRelatedFiles(names, versions) {
        return [];
    }
    async getMetas(names) {
        return [];
    }
}
exports.MapRender = MapRender;
class MapRenderFsBacked extends MapRender {
    fs;
    constructor(fs, config) {
        super(config);
        this.fs = fs;
    }
    makeFileName(layer, zoom, x, y, ext) {
        return `${layer}/${zoom}/${x}-${y}.${ext}`;
    }
    assertVersion(version = this.version) {
        if (version != 0 && version != this.version) {
            throw new Error("versions not supported");
        }
    }
    async saveFile(name, hash, data, version) {
        this.assertVersion(version);
        await this.fs.mkDir((0, scriptrunner_1.naiveDirname)(name));
        await this.fs.writeFile(name, data);
    }
    async getFileResponse(name, version) {
        this.assertVersion(version);
        try {
            let ext = name.match(/\.(\w+)$/);
            let mimetype = (ext ? ext[1] == "svg" ? "image/svg+xml" : `image/${ext[1]}` : "");
            await this.fs.mkDir((0, scriptrunner_1.naiveDirname)(name));
            let file = await this.fs.readFileBuffer(name);
            // Convert Buffer to Uint8Array for fetch compatibility
            return new Response(new Uint8Array(file.buffer, file.byteOffset, file.byteLength), { headers: { "content-type": mimetype } });
        }
        catch {
            return new Response(null, { status: 404 });
        }
    }
    async symlink(name, hash, targetname, targetversion) {
        this.assertVersion(targetversion);
        await this.fs.mkDir((0, scriptrunner_1.naiveDirname)(name));
        await this.fs.copyFile(targetname, name, true);
    }
}
exports.MapRenderFsBacked = MapRenderFsBacked;
//The Runeapps map saves directly to the server and keeps a version history, the server side code for this is non-public
//The render code decides which (opaque to server) file names should exist and checks if that name+hash already exists,
//if not it will generate the file and save it together with some metadata (hash+build nr)
class MapRenderDatabaseBacked extends MapRender {
    endpoint;
    workerid;
    uploadmapid;
    auth;
    overwrite;
    ignorebefore;
    rendermetaLayer;
    postThrottler = new utils_1.FetchThrottler(20);
    fileThrottler = new utils_1.FetchThrottler(20);
    constructor(endpoint, auth, workerid, uploadmapid, config, rendermetaLayer, overwrite, ignorebefore) {
        super(config);
        this.endpoint = endpoint;
        this.auth = auth;
        this.workerid = workerid;
        this.overwrite = overwrite;
        this.rendermetaLayer = rendermetaLayer;
        this.uploadmapid = uploadmapid;
        this.ignorebefore = ignorebefore;
    }
    static async create(endpoint, auth, uploadmapid, overwrite, ignorebefore) {
        let res = await fetch(`${endpoint}/config.json`, { headers: { "Authorization": auth } });
        if (!res.ok) {
            throw new Error("map config fetch error");
        }
        let config = await res.json();
        let rendermetaname = config.layers.find(q => q.mode == "rendermeta");
        let workerid = localStorage.map_workerid ?? "" + (Math.random() * 10000 | 0);
        localStorage.map_workerid ??= workerid;
        return new MapRenderDatabaseBacked(endpoint, auth, workerid, uploadmapid, config, rendermetaname, overwrite, ignorebefore);
    }
    makeFileName(layer, zoom, x, y, ext) {
        return `${layer}/${zoom}/${x}-${y}.${ext}`;
    }
    async beginMapVersion(version) {
        this.version = version;
        let send = await this.postThrottler.apiRequest(`${this.endpoint}/assurebuildnr?mapid=${this.uploadmapid}&buildnr=${this.version}`, {
            method: "post",
            headers: { "Authorization": this.auth },
            timeout: 1000 * 60 * 15
        });
        if (!send.ok) {
            throw new Error("failed to init map");
        }
    }
    async saveFile(name, hash, data, version = this.version) {
        let send = await this.postThrottler.apiRequest(`${this.endpoint}/upload?file=${encodeURIComponent(name)}&hash=${hash}&buildnr=${version}&mapid=${this.uploadmapid}`, {
            method: "post",
            headers: { "Authorization": this.auth },
            // Convert Buffer to ArrayBuffer for fetch compatibility
            body: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        });
        if (!send.ok) {
            throw new Error("file upload failed");
        }
    }
    async symlink(name, hash, targetname, targetversion) {
        return this.symlinkBatch([{ file: name, hash, buildnr: this.version, symlink: targetname, symlinkbuildnr: targetversion, symlinkfirstbuildnr: targetversion }]);
    }
    async symlinkBatch(files) {
        let version = this.version;
        let filtered = files.filter(q => q.file != q.symlink || version > q.symlinkbuildnr || version < q.symlinkfirstbuildnr);
        if (filtered.length == 0) {
            return;
        }
        let send = await this.postThrottler.apiRequest(`${this.endpoint}/uploadbatch?mapid=${this.uploadmapid}`, {
            method: "post",
            headers: {
                "Authorization": this.auth,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(files)
        });
        if (!send.ok) {
            throw new Error("file symlink failed");
        }
    }
    async getMetas(names) {
        if (this.overwrite) {
            return [];
        }
        else if (names.length == 0) {
            return [];
        }
        else {
            let req = await this.postThrottler.apiRequest(`${this.endpoint}/getmetas?file=${encodeURIComponent(names.map(q => `${q.name}!${q.hash}`).join(","))}&mapid=${this.uploadmapid}&buildnr=${this.version}&ignorebefore=${+this.ignorebefore}`, {
                headers: { "Authorization": this.auth },
            });
            if (!req.ok) {
                throw new Error("req failed");
            }
            return await req.json();
        }
    }
    async getRelatedFiles(names, versions) {
        if (names.length == 0 || versions.length == 0) {
            return [];
        }
        let req = await this.postThrottler.apiRequest(`${this.endpoint}/getfileversions?mapid=${this.uploadmapid}&ignorebefore=${+this.ignorebefore}`, {
            method: "post",
            headers: {
                "Authorization": this.auth,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                //TODO actually implement this?
                startversion: Math.min(...versions),
                endversion: Math.max(...versions),
                files: names
            })
        });
        if (!req.ok) {
            throw new Error("req faield");
        }
        let files = await req.json();
        return files;
    }
    getFileResponse(name, version = this.version) {
        let url = `${this.endpoint}/getnamed?file=${encodeURIComponent(name)}&version=${version}&mapid=${this.uploadmapid}`;
        return this.fileThrottler.apiRequest(url, { cache: "reload" });
    }
}
exports.MapRenderDatabaseBacked = MapRenderDatabaseBacked;
//TODO move to seperate file?
exports.examplemapconfig = `
{
	"$schema": "../generated/maprenderconfig.schema.json",
	//test gives a 3x3 area around lumby, "main" for the main world map, "full" for everything, a list of rectangles is also accepted eg: "50.50,20.20-70.70"
	"area": "test",//"45.45-55.55", //"50.45-51.46",
	//the size of the output images, usually 256 or 512
	"tileimgsize": 512,
	//set to true to keep the output y origin at the bottom left, equal to the game z origin
	"noyflip": false,
	//set to true to keep output chunks aligned with in-game chunks. Incurs performance penalty as more neighbouring chunks have to be loaded
	"nochunkoffset": false,
	//list of layers to render
	"layers": [
		{
			"name": "level-0", //name of the layer, this will be the folder name
			"mode": "3d", //3d world render
			"format": "webp", //currently only png and webp. jpeg in theory supported but not implemented or tested
			"level": 0, //floor level of the render, 0 means ground floor and all roofs are hidden, highest level is 3 which makes all roofs visible
			"pxpersquare": 64, //the level of detail for highest zoom level measured in pixels per map tile (1x1 meter). Subject to pxpersquare*64>tileimgsize, because it is currently not possible to render less than one image per mapchunk
			"dxdy": 0.15, //dxdy and dzdy to determine the view angle, 0,0 for straight down, something like 0.15,0.25 for birds eye
			"dzdy": 0.25
		},
		{
			"name": "topdown-0", //name of the layer, this will be the folder name
			"mode": "3d", //3d world render
			"format": "webp", //currently only png and webp. jpeg in theory supported but not implemented or tested
			"level": 0, //floor level of the render, 0 means ground floor and all roofs are hidden, highest level is 3 which makes all roofs visible
			"pxpersquare": 64, //the level of detail for highest zoom level measured in pixels per map tile (1x1 meter). Subject to pxpersquare*64>tileimgsize, because it is currently not possible to render less than one image per mapchunk
			"dxdy": 0, //dxdy and dzdy to determine the view angle, 0,0 for straight down, something like 0.15,0.25 for birds eye
			"dzdy": 0
		},
		{
			"name": "map",
			"mode": "map", //old style 2d map render
			"format": "png",
			"level": 0,
			"pxpersquare": 64,
			"mapicons": true,
			"wallsonly": false //can be turned on to create a walls overlay layer to use on top of an existing 3d layer
		},
		{
			"name": "minimap",
			"mode": "minimap", //minimap style render, similar to 3d but uses different shaders and emulates several rs bugs.
			"format": "webp",
			"level": 0,
			"pxpersquare": 64,
			"hidelocs": false, //can be turned on to emulate partially loaded minimap
			"mipmode": "avg", //results in every pixel of a mip image being exactly the mean of 4 zoomed pixels without any other filtering steps, required for minimap localization
			"dxdy": 0,
			"dzdy": 0
		},
		{
			"name": "collision",
			"mode": "collision", //pathing/line of sight as overlay image layer to use on "map" or "3d"
			"format": "png",
			"level": 0,
			"pxpersquare": 64
		},
		{
			"name": "height",
			"mode": "height", //binary file per chunk containing 16bit height data and 16 bits of collision data in base3 per tile
			"level": 0,
			"pxpersquare": 1, //unused but required
			"usegzip": true //gzips the resulting file, need some server config to serve the compressed file
		},
		{
			"name": "locs",
			"mode": "locs", //json file with locs per chunk
			"level": 0,
			"pxpersquare": 1, //unused but required
			"usegzip": false
		},
		{
			"name": "maplabels",
			"mode": "maplabels", //json file per chunk containing maplabel images and uses
			"level": 0,
			"pxpersquare": 1,
			"usegzip": false
		},
		{
			"name": "rendermeta",
			"mode": "rendermeta", //advanced - json file containing metadata about the chunk render, used to dedupe historic renders
			"level": 0,
			"pxpersquare": 1
		},
		{
			"name": "interactions",
			"mode": "interactions",
			"pxpersquare": 64, //same arguments as mode="3d"
			"dxdy": 0.15,
			"dzdy": 0.25,
			"format": "webp",
			"level": 0,
			"usegzip": true
		}
	],
	//used to determine lowest scaling mip level, should generally always be 100,200 which ensures the lowest mip level contains the entire rs world in one image
	"mapsizex": 100,
	"mapsizez": 200
}`;
