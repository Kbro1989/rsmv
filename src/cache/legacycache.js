"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyGroups = exports.legacyMajors = void 0;
exports.parseLegacyArchive = parseLegacyArchive;
exports.legacyPreload = legacyPreload;
exports.parseLegacyImageFile = parseLegacyImageFile;
exports.combineLegacyTexture = combineLegacyTexture;
const utils_1 = require("../utils");
const compression_1 = require("./compression");
const sprite_1 = require("../3d/sprite");
const imgutils_1 = require("../imgutils");
exports.legacyMajors = {
    data: 0, //mostly index 2 in dat2
    oldmodels: 1, //index 7 in dat2
    oldframebases: 2, //index 0 in dat2
    //3? has 636 files sprites?
    map: 4 // index 5 in dat2
};
exports.legacyGroups = {
    //1 login 
    config: 2,
    //3 interface?
    sprites: 4,
    index: 5,
    textures: 6
};
//pre-2006 caches
function parseLegacyArchive(file, major, isclassic) {
    if (!isclassic && major != 0) {
        return [{
                buffer: file,
                fileid: 0,
                namehash: null,
                offset: 0,
                size: file.byteLength
            }];
    }
    let stream = new utils_1.Stream(file);
    let len = stream.readTribyte();
    let compressedlen = stream.readTribyte();
    if (compressedlen != len) {
        stream = new utils_1.Stream((0, compression_1.legacybz2)(stream.readBuffer()));
        if (stream.bytesLeft() != len) {
            throw new Error("decompress failed");
        }
    }
    let files = [];
    let count = stream.readUShort(true);
    let filestream = stream.tee().skip(count * 10);
    for (let i = 0; i < count; i++) {
        let namehash = stream.readUInt(true);
        let subdecomplen = stream.readTribyte();
        let subcomplen = stream.readTribyte();
        let subfileoffset = filestream.scanloc();
        let subfile = filestream.readBuffer(subcomplen);
        if (subdecomplen != subcomplen) {
            subfile = (0, compression_1.legacybz2)(subfile);
            if (subfile.length != subdecomplen) {
                throw new Error("decompress failed");
            }
        }
        files.push({
            fileid: i,
            buffer: subfile,
            offset: subfileoffset,
            size: subdecomplen,
            namehash
        });
    }
    return files;
}
async function legacyPreload(engine) {
    let indexgroup = await engine.getArchiveById(exports.legacyMajors.data, exports.legacyGroups.index);
    let configgroup = await engine.getArchiveById(exports.legacyMajors.data, exports.legacyGroups.config);
    let r = {
        items: readLegacySubGroup(configgroup, "OBJ"),
        objects: readLegacySubGroup(configgroup, "LOC"),
        overlays: readLegacySubGroup(configgroup, "FLO"),
        npcs: readLegacySubGroup(configgroup, "NPC"),
        // spotanims: readLegacySubGroup(configgroup, "SPOT")
        underlays: [],
        spotanims: [],
        mapmeta: readLegacyMapIndex(indexgroup)
    };
    return r;
}
function readLegacyMapIndex(group) {
    let indexname = (0, utils_1.cacheFilenameHash)(`MAP_INDEX`, true);
    let versionname = (0, utils_1.cacheFilenameHash)(`MAP_VERSION`, true);
    let crcname = (0, utils_1.cacheFilenameHash)(`MAP_CRC`, true);
    let indexfile = group.find(q => q.namehash == indexname);
    let versionfile = group.find(q => q.namehash == versionname);
    let crcfile = group.find(q => q.namehash == crcname);
    if (!indexfile || !versionfile || !crcfile) {
        throw new Error();
    }
    let index = new utils_1.Stream(indexfile.buffer);
    let version = new utils_1.Stream(versionfile.buffer);
    let crc = new utils_1.Stream(crcfile.buffer);
    let mapinfo = new Map();
    while (!index.eof()) {
        mapinfo.set(index.readUShort(true), {
            map: index.readUShort(true),
            loc: index.readUShort(true),
            crc: crc.readUInt(true),
            version: version.readUShort(true)
        });
        index.readUByte(); //isf2p
    }
    return mapinfo;
}
function readLegacySubGroup(group, groupname) {
    let idxname = (0, utils_1.cacheFilenameHash)(`${groupname}.IDX`, true);
    let datname = (0, utils_1.cacheFilenameHash)(`${groupname}.DAT`, true);
    let idxfile = group.find(q => q.namehash == idxname);
    let datfile = group.find(q => q.namehash == datname);
    if (!idxfile || !datfile) {
        throw new Error();
    }
    let idx = new utils_1.Stream(idxfile.buffer);
    let count = idx.readUShort(true);
    let offset = 2; //skipping count
    let files = [];
    for (let i = 0; i < count; i++) {
        let size = idx.readUShort(true);
        files.push(datfile.buffer.slice(offset, offset + size));
        offset += size;
    }
    return files;
}
async function getLegacyImage(source, name, usetga) {
    let filename = `${name}.${usetga ? "tga" : "dat"}`;
    let spritefile = await source.findSubfileByName(exports.legacyMajors.data, exports.legacyGroups.textures, filename);
    if (usetga) {
        return (0, sprite_1.parseTgaSprite)(spritefile.buffer);
    }
    else {
        return parseLegacyImageFile(source, spritefile.buffer);
    }
}
async function parseLegacyImageFile(source, buf) {
    let metafile = await source.findSubfileByName(exports.legacyMajors.data, exports.legacyGroups.textures, "INDEX.DAT");
    return (0, sprite_1.parseLegacySprite)(metafile.buffer, buf);
}
async function combineLegacyTexture(engine, name, subname, useTga) {
    let img = await getLegacyImage(engine, name, useTga);
    if (!subname) {
        return img;
    }
    let subimg = await getLegacyImage(engine, subname, useTga);
    if (subimg.img.width + subimg.x > img.img.width || subimg.img.height + subimg.y > img.img.height) {
        //TODO probably fixable by using subimg.fullwidth
        console.warn("tried to overlay image outside of dest bounds");
        return img;
        throw new Error("tried to overlay image outside of dest bounds");
    }
    let combined = (0, imgutils_1.makeImageData)(img.img.data.slice(), img.img.width, img.img.height);
    for (let srcy = 0; srcy < subimg.img.height; srcy++) {
        for (let srcx = 0; srcx < subimg.img.width; srcx++) {
            let srci = (srcy * subimg.img.width + srcx) * 4;
            let dsti = ((srcy + subimg.y) * img.img.width + (srcx + subimg.x)) * 4;
            let subr = subimg.img.data[srci + 0];
            let subg = subimg.img.data[srci + 1];
            let subb = subimg.img.data[srci + 2];
            let suba = subimg.img.data[srci + 3];
            let forcetrans = (subr == 0 && subg == 255 && subb == 0 && suba == 255);
            let usesub = (suba == 255);
            combined.data[dsti + 0] = (forcetrans ? 0 : usesub ? subr : img.img.data[dsti + 0]);
            combined.data[dsti + 1] = (forcetrans ? 0 : usesub ? subg : img.img.data[dsti + 1]);
            combined.data[dsti + 2] = (forcetrans ? 0 : usesub ? subb : img.img.data[dsti + 2]);
            combined.data[dsti + 3] = (forcetrans ? 0 : usesub ? suba : img.img.data[dsti + 3]);
        }
    }
    return {
        x: img.x,
        y: img.y,
        fullwidth: img.fullwidth,
        fullheight: img.fullheight,
        img: combined
    };
}
