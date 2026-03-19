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
exports.parse = exports.FileParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const opcode_reader = __importStar(require("./opcode_reader"));
const comment_json_1 = __importDefault(require("comment-json"));
const __dirname = path.dirname((0, url_1.fileURLToPath)(import.meta.url));
const readJsonc = (relPath) => {
    const fullPath = path.join(__dirname, relPath);
    return fs.readFileSync(fullPath, "utf-8");
};
const typedef = comment_json_1.default.parse(readJsonc("./opcodes/typedef.jsonc"));
//alloc a large static buffer to write data to without knowing the data size
//then copy what we need out of it
//the buffer is reused so it saves a ton of buffer allocs
const scratchbuf = Buffer.alloc(2 * 1024 * 1024);
let bytesleftoverwarncount = 0;
class FileParser {
    parser;
    originalSource;
    totaltime = 0;
    static fromJson(jsonObject) {
        let opcodeobj = comment_json_1.default.parse(jsonObject, undefined, true);
        return new FileParser(opcodeobj, jsonObject);
    }
    constructor(opcodeobj, originalSource) {
        this.parser = opcode_reader.buildParser(null, opcodeobj, typedef);
        this.originalSource = originalSource ?? JSON.stringify(opcodeobj, undefined, "\t");
    }
    readInternal(state) {
        let t = performance.now();
        let res = this.parser.read(state);
        this.totaltime += performance.now() - t;
        if (state.scan != state.endoffset) {
            bytesleftoverwarncount++;
            if (bytesleftoverwarncount < 100) {
                console.log(`bytes left over after decoding file: ${state.endoffset - state.scan}`);
                // let name = `cache/bonusbytes-${Date.now()}.bin`;
                // require("fs").writeFileSync(name, scanbuf.slice(scanbuf.scan));
            }
            if (bytesleftoverwarncount == 100) {
                console.log("too many bytes left over warning, no more warnings will be logged");
            }
            // TODO remove this stupid condition, needed this to fail only in some situations
            if (state.buffer.byteLength < 100000) {
                // throw new Error(`bytes left over after decoding file: ${state.endoffset - state.scan}`);
                if (bytesleftoverwarncount < 5)
                    console.log(`Warning: bytes left over (${state.endoffset - state.scan}) but continuing...`);
            }
        }
        return res;
    }
    read(buffer, source, args) {
        let state = {
            isWrite: false,
            buffer,
            stack: [],
            hiddenstack: [],
            scan: 0,
            endoffset: buffer.byteLength,
            args: {
                ...source.getDecodeArgs(),
                ...args
            }
        };
        return this.readInternal(state);
    }
    write(obj, args) {
        let state = {
            isWrite: true,
            stack: [],
            hiddenstack: [],
            buffer: scratchbuf,
            scan: 0,
            endoffset: scratchbuf.byteLength,
            args: {
                clientVersion: 1000, //TODO
                ...args
            }
        };
        this.parser.write(state, obj);
        if (state.scan > state.endoffset) {
            throw new Error("tried to write file larger than scratchbuffer size");
        }
        //append footer data to end of normal data
        state.buffer.copyWithin(state.scan, state.endoffset, scratchbuf.byteLength);
        state.scan += scratchbuf.byteLength - state.endoffset;
        //do the weird prototype slice since we need a copy, not a ref
        let r = Uint8Array.prototype.slice.call(scratchbuf, 0, state.scan);
        //clear it for next use
        scratchbuf.fill(0, 0, state.scan);
        return r;
    }
}
exports.FileParser = FileParser;
globalThis.parserTimings = () => {
    let all = Object.entries(exports.parse).map(q => ({ name: q[0], t: q[1].totaltime }));
    all.sort((a, b) => b.t - a.t);
    all.slice(0, 10).filter(q => q.t > 0.01).forEach(q => console.log(`${q.name} ${q.t.toFixed(3)}s`));
};
exports.parse = allParsers();
function allParsers() {
    return {
        cacheIndex: FileParser.fromJson(readJsonc("./opcodes/cacheindex.json")),
        npc: FileParser.fromJson(readJsonc("./opcodes/npcs.jsonc")),
        item: FileParser.fromJson(readJsonc("./opcodes/items.jsonc")),
        object: FileParser.fromJson(readJsonc("./opcodes/objects.jsonc")),
        achievement: FileParser.fromJson(readJsonc("./opcodes/achievements.jsonc")),
        mapsquareTiles: FileParser.fromJson(readJsonc("./opcodes/mapsquare_tiles.jsonc")),
        mapsquareTilesNxt: FileParser.fromJson(readJsonc("./opcodes/mapsquare_tiles_nxt.jsonc")),
        mapsquareWaterTiles: FileParser.fromJson(readJsonc("./opcodes/mapsquare_watertiles.json")),
        mapsquareUnderlays: FileParser.fromJson(readJsonc("./opcodes/mapsquare_underlays.jsonc")),
        mapsquareOverlays: FileParser.fromJson(readJsonc("./opcodes/mapsquare_overlays.jsonc")),
        mapsquareLocations: FileParser.fromJson(readJsonc("./opcodes/mapsquare_locations.json")),
        mapsquareEnvironment: FileParser.fromJson(readJsonc("./opcodes/mapsquare_envs.jsonc")),
        mapZones: FileParser.fromJson(readJsonc("./opcodes/mapzones.json")),
        enums: FileParser.fromJson(readJsonc("./opcodes/enums.json")),
        fontmetrics: FileParser.fromJson(readJsonc("./opcodes/fontmetrics.jsonc")),
        mapscenes: FileParser.fromJson(readJsonc("./opcodes/mapscenes.json")),
        sequences: FileParser.fromJson(readJsonc("./opcodes/sequences.json")),
        framemaps: FileParser.fromJson(readJsonc("./opcodes/framemaps.jsonc")),
        frames: FileParser.fromJson(readJsonc("./opcodes/frames.json")),
        animgroupConfigs: FileParser.fromJson(readJsonc("./opcodes/animgroupconfigs.jsonc")),
        models: FileParser.fromJson(readJsonc("./opcodes/models.jsonc")),
        oldmodels: FileParser.fromJson(readJsonc("./opcodes/oldmodels.jsonc")),
        classicmodels: FileParser.fromJson(readJsonc("./opcodes/classicmodels.jsonc")),
        spotAnims: FileParser.fromJson(readJsonc("./opcodes/spotanims.json")),
        rootCacheIndex: FileParser.fromJson(readJsonc("./opcodes/rootcacheindex.jsonc")),
        skeletalAnim: FileParser.fromJson(readJsonc("./opcodes/skeletalanim.jsonc")),
        materials: FileParser.fromJson(readJsonc("./opcodes/materials.jsonc")),
        oldmaterials: FileParser.fromJson(readJsonc("./opcodes/oldmaterials.jsonc")),
        quickchatCategories: FileParser.fromJson(readJsonc("./opcodes/quickchatcategories.jsonc")),
        quickchatLines: FileParser.fromJson(readJsonc("./opcodes/quickchatlines.jsonc")),
        environments: FileParser.fromJson(readJsonc("./opcodes/environments.jsonc")),
        avatars: FileParser.fromJson(readJsonc("./opcodes/avatars.jsonc")),
        avatarOverrides: FileParser.fromJson(readJsonc("./opcodes/avataroverrides.jsonc")),
        identitykit: FileParser.fromJson(readJsonc("./opcodes/identitykit.jsonc")),
        structs: FileParser.fromJson(readJsonc("./opcodes/structs.jsonc")),
        params: FileParser.fromJson(readJsonc("./opcodes/params.jsonc")),
        particles_0: FileParser.fromJson(readJsonc("./opcodes/particles_0.jsonc")),
        particles_1: FileParser.fromJson(readJsonc("./opcodes/particles_1.jsonc")),
        audio: FileParser.fromJson(readJsonc("./opcodes/audio.jsonc")),
        proctexture: FileParser.fromJson(readJsonc("./opcodes/proctexture.jsonc")),
        oldproctexture: FileParser.fromJson(readJsonc("./opcodes/oldproctexture.jsonc")),
        maplabels: FileParser.fromJson(readJsonc("./opcodes/maplabels.jsonc")),
        cutscenes: FileParser.fromJson(readJsonc("./opcodes/cutscenes.jsonc")),
        clientscript: FileParser.fromJson(readJsonc("./opcodes/clientscript.jsonc")),
        clientscriptdata: FileParser.fromJson(readJsonc("./opcodes/clientscriptdata.jsonc")),
        interfaces: FileParser.fromJson(readJsonc("./opcodes/interfaces.jsonc")),
        dbtables: FileParser.fromJson(readJsonc("./opcodes/dbtables.jsonc")),
        dbrows: FileParser.fromJson(readJsonc("./opcodes/dbrows.jsonc"))
    };
}
