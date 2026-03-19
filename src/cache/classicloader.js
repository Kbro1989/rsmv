"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassicFileSource = exports.classicBuilds = exports.classicGroups = void 0;
exports.detectClassicVersions = detectClassicVersions;
exports.classicConfig = classicConfig;
const _1 = require(".");
const utils_1 = require("../utils");
const legacycache_1 = require("./legacycache");
exports.classicGroups = {
    //same as early rs2
    textures: 6,
    //classic only
    models: 101,
    entity: 102,
    maps: 103,
    land: 104,
    filter: 105,
    jagex: 106,
    media: 107,
    sounds: 108,
    config: 110
};
function cversion(buildnr, date, config, maps, land, media, models, textures, entity, sounds, filter, locsjson, name) {
    return {
        buildnr,
        locsjson,
        name,
        date,
        versions: { config, maps, land, media, models, textures, entity, sounds, filter }
    };
}
//subset of https://classic.runescape.wiki/w/User:Logg#Combined_update,_client,_and_cache_history_table
exports.classicBuilds = [
    cversion(115, new Date("2001-12-24 20:28"), 48, 27, 0, 28, 12, 8, 10, 0, 0, null, "dec 2001 - last original world data"),
    cversion(230, new Date("2004-02-18 11:43"), 100, 100, 100, 100, 100, 100, 100, 100, 100, "SceneryLocs.json", "Last version of entered files")
];
//reverse lookup
const classicGroupNames = Object.fromEntries(Object.entries(exports.classicGroups)
    .map(([name, id]) => [id, name]));
function detectClassicVersions(filenames) {
    let versions = [];
    for (let build of exports.classicBuilds) {
        versions.push({
            buildnr: build.buildnr,
            iscomplete: false,
            locsjson: build.locsjson,
            target: build.versions,
            foundjag: Object.fromEntries(Object.entries(build.versions).map(([key]) => [key, 0])),
            foundmem: Object.fromEntries(Object.entries(build.versions).map(([key]) => [key, 0]))
        });
    }
    for (let filename of filenames) {
        let namematch = filename.match(/^(?<name>[a-zA-Z]+)(?<version>\d+)\.(?<type>jag|mem)$/);
        if (namematch) {
            let version = +namematch.groups.version;
            let ismem = namematch.groups.type == "mem";
            let cachename = namematch.groups.name;
            //just ignore mem for versioning purposes for now
            for (let cache of versions) {
                let found = (ismem ? cache.foundmem : cache.foundjag);
                if (cache.target[cachename] && version <= cache.target[cachename] && version > found[cachename]) {
                    found[cachename] = version;
                }
            }
        }
    }
    for (let cache of versions) {
        let complete = true;
        for (let key in cache.target) {
            if (cache.foundjag[key] != cache.target[key]) {
                complete = false;
            }
            //TODO only checking mem version, not if they are missing since we don't know if they should exist
            if (cache.foundmem[key] != 0 && cache.foundmem[key] != cache.target[key]) {
                complete = false;
            }
        }
        cache.iscomplete = complete;
    }
    return versions;
}
class ClassicFileSource extends _1.CacheFileSource {
    usingversion;
    fs;
    constructor(fs, version) {
        super();
        this.fs = fs;
        this.usingversion = version;
    }
    static async create(files, version) {
        if (!version) {
            let filenames = await files.readDir(".");
            let versions = detectClassicVersions(filenames.map(q => q.name));
            let index = localStorage.rsmv_classicversion ?? "-1";
            version = versions.at(+index);
        }
        return new ClassicFileSource(files, version);
    }
    async getFileArchive(meta) {
        if (meta.major != 0) {
            throw new Error("all files are placed in index 0 for classic caches");
        }
        let name = classicGroupNames[meta.minor];
        let jagfile = await this.getNamedFile(name, false);
        let memfile = await this.getNamedFile(name, true);
        let jagarch = (!jagfile ? [] : (0, legacycache_1.parseLegacyArchive)(jagfile, meta.major, true));
        let memarch = (!memfile ? [] : (0, legacycache_1.parseLegacyArchive)(memfile, meta.major, true));
        if (jagarch.length == 0 && memarch.length == 0) {
            throw new Error("no files found in index " + meta.minor);
        }
        return [...jagarch, ...memarch];
    }
    async getNamedFile(name, mem) {
        if (!this.usingversion || !this.fs) {
            throw new Error("no classic files loaded in classic cache loader");
        }
        let version = (mem ? this.usingversion.foundmem : this.usingversion.foundjag)[name];
        if (!version) {
            return null;
        }
        let filename = `${name}${version}.${mem ? "mem" : "jag"}`;
        console.log("loading", filename);
        return this.fs.readFileBuffer(filename);
    }
    getBuildNr() {
        return this.usingversion?.buildnr ?? 200; //somewhat high rsc build nr
    }
    getCacheMeta() {
        if (!this.usingversion) {
            return { name: "Classic", descr: "no files loaded", timestamp: new Date(0) };
        }
        return {
            name: `Classic ${this.getBuildNr()}`,
            descr: `${Object.entries(this.usingversion.foundjag).map(([key, v]) => `${key}: ${v}`).join("\n")}`,
            timestamp: new Date(0)
        };
    }
    async getFile(major, minor) {
        throw new Error("can only load archives in a classic cache");
    }
}
exports.ClassicFileSource = ClassicFileSource;
function mapprops(count, template) {
    let res = new Array(count).fill(null).map(() => ({}));
    for (let [key, callback] of Object.entries(template)) {
        for (let i = 0; i < count; i++) {
            res[i][key] = callback();
        }
    }
    return res;
}
async function classicConfig(source, buildnr) {
    let modelarchive = await source.getArchiveById(0, exports.classicGroups.models);
    let stringsbuf = (await source.findSubfileByName(0, exports.classicGroups.config, "STRING.DAT")).buffer;
    let intbuf = (await source.findSubfileByName(0, exports.classicGroups.config, "INTEGER.DAT")).buffer;
    let stringcursor = 0;
    let getstring = () => {
        let start = stringcursor;
        while (stringcursor < stringsbuf.length && stringsbuf[stringcursor++] != 0)
            ;
        return stringsbuf.toString("latin1", start, stringcursor - 1);
    };
    let intcursor = 0;
    let getuint = () => { let r = intbuf.readUint32BE(intcursor); intcursor += 4; return r; };
    let getint = () => { let r = intbuf.readInt32BE(intcursor); intcursor += 4; return r; };
    let getushort = () => { let r = intbuf.readUint16BE(intcursor); intcursor += 2; return r; };
    let getubyte = () => intbuf.readUint8(intcursor++);
    let getbool = () => !!getubyte();
    let items = mapprops(getushort(), {
        name: getstring,
        examine: getstring,
        command: getstring,
        sprite: getushort,
        price: (buildnr < 180 ? getushort : getuint), //exact build nr unknown
        stackable: getbool,
        special: getbool,
        equip: getushort,
        color: getuint,
        untradeable: (buildnr < 180 ? () => false : getbool), //exact build nr unknown
        member: (buildnr < 180 ? () => false : getbool) //exact build nr unknown
    });
    let npcs = mapprops(getushort(), {
        name: getstring,
        examine: getstring,
        command: (buildnr < 180 ? () => "" : getstring), //exact build nr unknown
        attack: getubyte,
        strength: getubyte,
        hits: getubyte,
        defence: getubyte,
        hostility: getubyte,
        anims: () => new Array(12).fill(null).map(getubyte),
        haircolor: getuint,
        topcolor: getuint,
        bottomcolor: getuint,
        skincolor: getuint,
        width: getushort,
        height: getushort,
        walkmodel: getubyte,
        combatmodel: getubyte,
        combatanim: getubyte
    });
    let textures = mapprops(getushort(), {
        name: getstring,
        subname: getstring
    });
    let anims = mapprops(getushort(), {
        name: getstring,
        color: getuint,
        gendermodel: getubyte,
        has_a: getbool,
        has_f: getbool,
        unk: getubyte
    });
    let objects = mapprops(getushort(), {
        name: getstring,
        examine: getstring,
        command_0: getstring,
        command_1: getstring,
        model: () => {
            let name = getstring();
            let namehash = (0, utils_1.cacheFilenameHash)(`${name}.ob3`, true);
            let id = modelarchive.find(q => q.namehash == namehash)?.fileid;
            return { name, id };
        },
        xsize: getubyte,
        zsize: getubyte,
        type: getubyte,
        item_height: getubyte
    });
    let wallobjects = mapprops(getushort(), {
        name: getstring,
        examine: getstring,
        command_0: getstring,
        command_1: getstring,
        height: getushort,
        frontdecor: getint,
        backdecor: getint,
        blocked: getbool,
        invisible: getbool
    });
    let roofs = mapprops(getushort(), {
        height: getubyte,
        texture: getubyte
    });
    let tiles = mapprops(getushort(), {
        decor: getuint,
        type: () => {
            let type = getubyte();
            return {
                type,
                autoconnect: type == 1 || type == 3,
                indoors: type == 2,
                iswater: type == 3,
                bridge: type == 4
            };
        },
        blocked: getbool
    });
    let projectile = mapprops(getushort(), {
    //empty
    });
    let spells = mapprops(getushort(), {
        name: getstring,
        examine: getstring,
        level: getubyte,
        num_runes: getubyte,
        type: getubyte,
        runetypes: () => new Array(getubyte()).fill(null).map(getushort),
        runeamounts: () => new Array(getubyte()).fill(null).map(getubyte)
    });
    let prayers = mapprops(getushort(), {
        name: getstring,
        examine: getstring,
        level: getubyte,
        drain: getubyte
    });
    console.log(`decoded rsc config, ints ${intcursor}/${intbuf.length}, strings ${stringcursor}/${stringsbuf.length}`);
    let jsonlocs = [];
    if (source.usingversion.locsjson) {
        try {
            let raw = JSON.parse(await source.fs.readFileText(source.usingversion.locsjson));
            let levelstride = 20 * 48 - 16; //???
            jsonlocs = raw.sceneries.map(q => ({
                id: q.id,
                dir: q.direction,
                level: Math.floor(q.pos.Y / levelstride),
                x: 48 * 48 + q.pos.X,
                z: 37 * 48 + q.pos.Y % levelstride,
            }));
        }
        catch (e) {
            console.warn("failed to load external classic locs");
        }
    }
    return { items, npcs, textures, anims, objects, wallobjects, roofs, tiles, projectile, spells, prayers, jsonlocs };
}
