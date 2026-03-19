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
exports.Openrs2CacheSource = void 0;
exports.loadOpenrsCachelist = loadOpenrsCachelist;
exports.validOpenrs2Caches = validOpenrs2Caches;
exports.openrs2GetEffectiveBuildnr = openrs2GetEffectiveBuildnr;
const cache = __importStar(require("./index"));
const compression_1 = require("./compression");
const constants_1 = require("../constants");
const node_fetch_1 = __importDefault(require("node-fetch"));
const fscache_1 = require("./fscache");
const endpoint = `https://archive.openrs2.org`;
var downloadedBytes = 0;
var validcachelist = null;
var cachelist = null;
function loadOpenrsCachelist() {
    cachelist ??= (0, node_fetch_1.default)(`${endpoint}/caches.json`).then(q => q.json());
    return cachelist;
}
function validOpenrs2Caches() {
    validcachelist ??= (async () => {
        const openrs2Blacklist = [
            //some of these might actually be fine
            423, //osrs cache wrongly labeled as rs3?
            623, //seems to have different builds in it
            693, //wrong timestamp?
            621, 619, 618, 620, 617, //wrong timestamp/osrs?
            840, //multiple builds
            734, 736, 733, 732, 731, //don't have items index
            20, 19, 17, 13, 10, 9, 8, 7, 6, 5, //don't have items index
            2, //missing basically everything
            1255, //missing files and invalid compression?
            905, //missing textures
            1256, //missing materials
            1003, //missing materials
            638, //missing materials
            542, //missing models
            463, //wrong build number?
            //large gaps in files according to openrs2ids command
            621, 623, 620, 617, 618, 619,
            734, 733, 20, 10, 9, 8, 7, 2,
            666, 729, 730, 728,
            1455, //weird clientscript
            312, 286, 1420, 1421, 1530, //missing clientscripts
            //TODO fix these or figure out whats wrong with them
            1480,
            644, 257, //incomplete textures
            1456, 1665, //missing materials
            1479, //missing items could probably be worked around
        ];
        let allcaches = await loadOpenrsCachelist();
        let checkedcaches = allcaches.filter(q => q.language == "en" && q.environment == "live" && !openrs2Blacklist.includes(q.id)
            && q.game == "runescape" && q.timestamp && q.builds.length != 0).sort((a, b) => b.builds[0].major - a.builds[0].major || (b.builds[0].minor ?? 0) - (a.builds[0].minor ?? 0) || +new Date(b.timestamp) - +new Date(a.timestamp));
        return checkedcaches;
    })();
    return validcachelist;
}
function openrs2GetEffectiveBuildnr(cachemeta) {
    let match = cachemeta.builds.find(q => q.major != 0);
    return (match ? match.major : -1);
}
class Openrs2CacheSource extends cache.DirectCacheFileSource {
    meta;
    buildnr;
    xteaKeysLoaded = false;
    xteakeysPromise = null;
    fscache;
    static async fromId(cacheid) {
        let caches = await loadOpenrsCachelist();
        let meta = caches.find(q => q.id == cacheid);
        if (!meta) {
            throw new Error(`cache ${cacheid} not found on openrs`);
        }
        return new Openrs2CacheSource(meta);
    }
    constructor(meta) {
        super(false);
        this.meta = meta;
        let buildnr = openrs2GetEffectiveBuildnr(meta);
        if (buildnr != -1) {
            this.buildnr = buildnr;
        }
        else {
            console.warn("using historic cache for which the build number is not available, treating it as current.");
            this.buildnr = constants_1.latestBuildNumber;
        }
        this.fscache = fscache_1.FileSourceFsCache.tryCreate();
    }
    getCacheMeta() {
        return {
            name: `openrs2:${this.meta.id}`,
            descr: `build: ${this.buildnr}`
                + `\ndate: ${new Date(this.meta.timestamp ?? "").toDateString()}`
                + `\nHistoric cache loaded from openrs2 cache repository.`,
            timestamp: new Date(this.meta.timestamp ?? 0)
        };
    }
    getBuildNr() {
        return this.buildnr;
    }
    async getCacheIndex(major) {
        if (this.buildnr <= 700 && !this.xteaKeysLoaded && major == constants_1.cacheMajors.mapsquares) {
            this.xteakeysPromise ??= (async () => {
                this.xteakeys ??= new Map();
                let keys = await (0, node_fetch_1.default)(`${endpoint}/caches/runescape/${this.meta.id}/keys.json`).then(q => q.json());
                for (let key of keys) {
                    //merge into one 31bit int
                    let lookupid = (key.archive << 23) | key.group;
                    this.xteakeys.set(lookupid, new Uint32Array(key.key));
                }
                this.xteaKeysLoaded = true;
                console.log(`loaded ${keys.length} xtea keys`);
            })();
            await this.xteakeysPromise;
        }
        return super.getCacheIndex(major);
    }
    static async getRecentCache(count = 0) {
        let relevantcaches = await validOpenrs2Caches();
        return relevantcaches[count];
    }
    async downloadFile(major, minor) {
        // we don't have metadata for the root index file 255.255, and legacy caches don't use version/crc
        let url;
        if ((major == constants_1.cacheMajors.index && minor == constants_1.cacheMajors.index) || this.getBuildNr() <= constants_1.lastLegacyBuildnr) {
            // slower endpoint that doesn't require crc/version
            url = `${endpoint}/caches/runescape/${this.meta.id}/archives/${major}/groups/${minor}.dat`;
        }
        else {
            // fast endpoint that uses crc and version
            let index = await this.getIndexEntryById(major, minor);
            url = `${endpoint}/caches/runescape/archives/${major}/groups/${minor}/versions/${index.version}/checksums/${index.crc | 0}.dat`;
        }
        const req = await (0, node_fetch_1.default)(url);
        if (!req.ok) {
            throw new Error(`failed to download cache file ${major}.${minor} from openrs2 ${this.meta.id}, http code: ${req.status}`);
        }
        const buf = await req.arrayBuffer();
        let res = Buffer.from(buf);
        //at least make sure we are aware if we're ddossing someone....
        if (Math.floor(downloadedBytes / 10_000_000) != Math.floor((downloadedBytes + buf.byteLength) / 10_000_000)) {
            console.info(`loaded ${(downloadedBytes + res.byteLength) / 1000_000 | 0} mb from openrs2`);
        }
        downloadedBytes += res.byteLength;
        return res;
    }
    async getFile(major, minor, crc) {
        let cachedfile = null;
        if (this.fscache && typeof crc != "undefined" && crc != 0) { //TODO fix places that use a magic 0 crc
            cachedfile = await this.fscache.getFile(major, minor, crc);
        }
        else {
            // console.log("uncachable", major, minor, crc);
        }
        let rawfile = cachedfile ?? await this.downloadFile(major, minor);
        if (this.fscache && !cachedfile && typeof crc != "undefined" && crc != 0) {
            this.fscache.addFile(major, minor, crc, rawfile);
        }
        if (this.buildnr <= constants_1.lastLegacyBuildnr) {
            if (major == 0) {
                return rawfile;
            }
            else {
                return (0, compression_1.legacyGzip)(rawfile);
            }
        }
        else {
            return (0, compression_1.decompress)(rawfile, this.getXteaKey(major, minor));
        }
    }
}
exports.Openrs2CacheSource = Openrs2CacheSource;
