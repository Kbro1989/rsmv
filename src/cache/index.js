"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallbackCacheLoader = exports.DirectCacheFileSource = exports.CacheFileSource = exports.oldConfigMaps = exports.mappedFileIds = exports.Archive = void 0;
exports.packSqliteBufferArchive = packSqliteBufferArchive;
exports.unpackSqliteBufferArchive = unpackSqliteBufferArchive;
exports.packBufferArchive = packBufferArchive;
exports.unpackBufferArchive = unpackBufferArchive;
exports.rootIndexBufferToObject = rootIndexBufferToObject;
exports.indexBufferToObject = indexBufferToObject;
exports.fileIdToArchiveminor = fileIdToArchiveminor;
exports.archiveToFileId = archiveToFileId;
const crc32util_1 = require("../libs/crc32util");
const constants_1 = require("../constants");
const opdecoder_1 = require("../opdecoder");
const utils_1 = require("../utils");
const legacycache_1 = require("./legacycache");
globalThis.ignoreCache = false;
function packSqliteBufferArchive(buffers) {
    return new Archive(buffers).packSqlite();
}
function unpackSqliteBufferArchive(buffer, subids, namehashes) {
    if (subids.length == 1) {
        return [{ buffer, offset: 0, size: buffer.byteLength, fileid: subids[0], namehash: namehashes?.[0] ?? null }];
    }
    let index = 0;
    let unknownbyte = buffer.readUInt8(index);
    index++;
    //console.log("unknownbyte sqlarchive", unknownbyte);
    let fileoffset = buffer.readUInt32BE(index);
    index += 4;
    let files = [];
    for (let filenr = 0; filenr < subids.length; filenr++) {
        let endoffset = buffer.readUInt32BE(index);
        index += 4;
        files.push({
            buffer: buffer.slice(fileoffset, endoffset),
            offset: fileoffset,
            size: endoffset - fileoffset,
            fileid: subids[filenr],
            namehash: namehashes?.[filenr] ?? null
        });
        fileoffset = endoffset;
    }
    return files;
}
class Archive {
    files;
    constructor(files) {
        this.files = files;
    }
    forgecrc(wantedcrc, gapfileindex, gapoffset) {
        let frontcrc = 0;
        for (let i = 0; i < this.files.length; i++) {
            if (i == gapfileindex) {
                frontcrc = (0, crc32util_1.crc32)(this.files[i], frontcrc, 0, gapoffset);
                break;
            }
            frontcrc = (0, crc32util_1.crc32)(this.files[i], frontcrc);
        }
        let backcrc = wantedcrc;
        backcrc = (0, crc32util_1.crc32_backward)(this.networkFooter(), backcrc);
        for (let i = this.files.length - 1; i >= 0; i--) {
            if (i == gapfileindex) {
                backcrc = (0, crc32util_1.crc32)(this.files[i], backcrc, 0, gapoffset + 4);
                break;
            }
            backcrc = (0, crc32util_1.crc32)(this.files[i], backcrc);
        }
        console.log("forging file", gapfileindex, gapoffset, (0, crc32util_1.forge_crcbytes)(frontcrc, backcrc));
        this.files[gapfileindex] = Buffer.from(this.files[gapfileindex]);
        (0, crc32util_1.forge_crcbytes)(frontcrc, backcrc).copy(this.files[gapfileindex], gapoffset);
    }
    networkFooter() {
        if (this.files.length == 1) {
            return Buffer.from([]);
        }
        let len = 1 + this.files.length * 4;
        let result = Buffer.alloc(len);
        let lastsize = 0;
        let footerindex = 0;
        for (let buf of this.files) {
            result.writeInt32BE(buf.byteLength - lastsize, footerindex);
            lastsize = buf.byteLength;
            footerindex += 4;
        }
        result.writeUInt8(0x01, len - 1); //why is this byte 0x01
        return result;
    }
    packNetwork() {
        return Buffer.concat([...this.files, this.networkFooter()]);
    }
    sqliteHeader() {
        if (this.files.length == 1) {
            return Buffer.from([]);
        }
        let headersize = 1 + 4 + this.files.length * 4;
        let result = Buffer.alloc(headersize);
        let offset = 0;
        let dataoffset = headersize; //start of first file
        result.writeUInt8(0x1, offset);
        offset++; //unknown
        result.writeUInt32BE(dataoffset, offset);
        offset += 4;
        for (let buffer of this.files) {
            dataoffset += buffer.byteLength;
            result.writeUInt32BE(dataoffset, offset);
            offset += 4; //index at end of file
        }
        return result;
    }
    packSqlite() {
        return Buffer.concat([this.sqliteHeader(), ...this.files,]);
    }
}
exports.Archive = Archive;
function packBufferArchive(buffers) {
    return new Archive(buffers).packNetwork();
}
function unpackBufferArchive(buffer, subids, namehashes) {
    if (subids.length == 1) {
        let r = [{
                buffer: buffer,
                offset: 0,
                size: buffer.byteLength,
                fileid: subids[0],
                namehash: namehashes?.[0] ?? null
            }];
        return r;
    }
    let nchunks = buffer.readUInt8(buffer.length - 1);
    var suboffsetScan = buffer.length - 1 - (4 * subids.length * nchunks);
    var subbufs = [];
    var scan = 0x0;
    for (let chunkindex = 0; chunkindex < nchunks; chunkindex++) {
        var lastRecordSize = 0;
        for (var fileindex = 0; fileindex < subids.length; ++fileindex) {
            //the field contains the difference in size from the last record?
            lastRecordSize += buffer.readInt32BE(suboffsetScan);
            suboffsetScan += 4;
            let size = lastRecordSize;
            let recordBuffer = buffer.slice(scan, scan + size);
            scan += size;
            let oldchunk = subbufs[fileindex];
            if (oldchunk) {
                oldchunk.buffer = Buffer.concat([oldchunk.buffer, recordBuffer]);
                oldchunk.size += size;
            }
            else {
                subbufs[fileindex] = {
                    buffer: recordBuffer,
                    offset: scan,
                    size,
                    fileid: subids[fileindex],
                    namehash: namehashes?.[fileindex] ?? null
                };
            }
        }
    }
    return subbufs;
}
function rootIndexBufferToObject(metaindex, source) {
    let index = opdecoder_1.parse.rootCacheIndex.read(metaindex, source);
    return index.cachemajors
        .map(q => {
        if (q.crc == 0) {
            return undefined;
        }
        let r = {
            major: 255,
            minor: q.minor,
            crc: q.crc,
            version: q.version,
            size: 0,
            name: null,
            subindexcount: q.subindexcount,
            subindices: [0],
            subnames: null,
            uncompressed_crc: 0,
            uncompressed_size: 0,
        };
        return r;
    });
}
function indexBufferToObject(major, buffer, source) {
    if (major == constants_1.cacheMajors.index) {
        return rootIndexBufferToObject(buffer, source);
    }
    let readres = opdecoder_1.parse.cacheIndex.read(buffer, source);
    let indices = readres.indices;
    let linear = [];
    for (let entry of indices) {
        linear[entry.minor] = Object.assign(entry, { major });
    }
    return linear;
}
exports.mappedFileIds = {
    [constants_1.cacheMajors.items]: 256,
    [constants_1.cacheMajors.npcs]: 128,
    [constants_1.cacheMajors.structs]: 32,
    [constants_1.cacheMajors.enums]: 256,
    [constants_1.cacheMajors.objects]: 256,
    [constants_1.cacheMajors.sequences]: 128,
    [constants_1.cacheMajors.spotanims]: 256,
    [constants_1.cacheMajors.achievements]: 128,
    [constants_1.cacheMajors.materials]: Number.MAX_SAFE_INTEGER //is single index
};
exports.oldConfigMaps = {
    [constants_1.cacheMajors.items]: constants_1.cacheConfigPages.items_old,
    [constants_1.cacheMajors.npcs]: constants_1.cacheConfigPages.npcs_old,
    [constants_1.cacheMajors.objects]: constants_1.cacheConfigPages.locs_old,
    [constants_1.cacheMajors.spotanims]: constants_1.cacheConfigPages.spotanim_old
};
function fileIdToArchiveminor(major, fileid, buildnr) {
    if (buildnr < 488) {
        let page = exports.oldConfigMaps[major];
        if (page !== undefined) {
            return { major: constants_1.cacheMajors.config, minor: page, subid: fileid };
        }
    }
    let archsize = exports.mappedFileIds[major] ?? 1;
    let holderindex = Math.floor(fileid / archsize);
    return { minor: holderindex, major, subid: fileid % archsize };
}
function archiveToFileId(major, minor, subfile) {
    let archsize = exports.mappedFileIds[major] ?? 1;
    return minor * archsize + subfile;
}
class CacheFileSource {
    decodeArgs = {};
    getCacheMeta() {
        return { name: "unkown", descr: "", timestamp: new Date(0) };
    }
    //could use abstract here but typings get weird
    getFile(major, minor, crc) {
        throw new Error("not implemented");
    }
    getFileArchive(index) {
        throw new Error("not implemented");
    }
    getCacheIndex(major) {
        throw new Error("not implemented");
    }
    getBuildNr() {
        return constants_1.latestBuildNumber;
    }
    getDecodeArgs() {
        //can't initialize this in constructor because sub class wont be ready yet
        this.decodeArgs.clientVersion = this.getBuildNr();
        return this.decodeArgs;
    }
    writeFile(major, minor, file) {
        throw new Error("not implemented");
    }
    writeFileArchive(major, minor, files) {
        throw new Error("not implemented");
    }
    async getIndexEntryById(major, minor) {
        let index;
        if (this.getBuildNr() <= constants_1.lastLegacyBuildnr) {
            index = { major, minor, crc: 0, name: null, subindexcount: 1, subindices: [0], subnames: null, version: 0 };
        }
        else {
            let indexfile = await this.getCacheIndex(major);
            index = indexfile[minor];
        }
        if (!index) {
            throw new Error(`minor id ${minor} does not exist in major ${major}.`);
        }
        return index;
    }
    async getArchiveById(major, minor) {
        let index = await this.getIndexEntryById(major, minor);
        return this.getFileArchive(index);
    }
    async getFileById(major, fileid) {
        let holderindex = fileIdToArchiveminor(major, fileid, this.getBuildNr());
        let files = await this.getArchiveById(holderindex.major, holderindex.minor);
        let match = files.find(q => q.fileid == holderindex.subid);
        if (!match) {
            throw new Error(`File ${fileid} in major ${major} not found, (redirected to ${holderindex.major}.${holderindex.minor}.${holderindex.subid})`);
        }
        return match.buffer;
    }
    async findFileByName(major, name) {
        let hash = (0, utils_1.cacheFilenameHash)(name, this.getBuildNr() <= constants_1.lastLegacyBuildnr);
        let indexfile = await this.getCacheIndex(major);
        return indexfile.find(q => q && q.name == hash);
    }
    async findSubfileByName(major, minor, name) {
        let hash = (0, utils_1.cacheFilenameHash)(name, this.getBuildNr() <= constants_1.lastLegacyBuildnr);
        let arch = await this.getArchiveById(major, minor);
        return arch.find(q => q && q.namehash == hash);
    }
    //for testing only
    async bruteForceFindAnyNamedFile(name) {
        let rootindex = await this.getCacheIndex(constants_1.cacheMajors.index);
        for (let index of rootindex) {
            if (!index) {
                continue;
            }
            let res = await this.findFileByName(index.minor, name);
            if (res) {
                return this.getFileArchive(res);
            }
        }
        return null;
    }
    close() { }
}
exports.CacheFileSource = CacheFileSource;
//basic implementation for cache sources that only download major/minor pairs
class DirectCacheFileSource extends CacheFileSource {
    indexMap = new Map();
    requiresCrc;
    xteakeys = null;
    constructor(needscrc) {
        super();
        this.requiresCrc = needscrc;
    }
    getFile(major, minor, crc) {
        throw new Error("not implemented");
    }
    async getFileArchive(meta) {
        let file = await this.getFile(meta.major, meta.minor, meta.crc);
        if (this.getBuildNr() <= constants_1.lastLegacyBuildnr) {
            return (0, legacycache_1.parseLegacyArchive)(file, meta.major, this.getBuildNr() <= constants_1.lastClassicBuildnr);
        }
        else {
            return unpackBufferArchive(file, meta.subindices, meta.subnames);
        }
    }
    getXteaKey(major, minor) {
        let key = (major << 23) | minor;
        return this.xteakeys?.get(key);
    }
    getCacheIndex(major) {
        let index = this.indexMap.get(major);
        if (!index) {
            index = (async () => {
                let crc = undefined;
                if (this.requiresCrc && major != constants_1.cacheMajors.index) {
                    let index = await this.getCacheIndex(constants_1.cacheMajors.index);
                    crc = index[major].crc;
                }
                let indexfile = await this.getFile(constants_1.cacheMajors.index, major, crc);
                let decoded = indexBufferToObject(major, indexfile, this);
                return decoded;
            })();
            this.indexMap.set(major, index);
        }
        return index;
    }
}
exports.DirectCacheFileSource = DirectCacheFileSource;
class CallbackCacheLoader extends DirectCacheFileSource {
    constructor(fn, needsCrc) {
        super(needsCrc);
        this.getFile = fn;
    }
    getCacheMeta() {
        return { name: "callback", descr: "Cache source based on external getter", timestamp: new Date(0) };
    }
}
exports.CallbackCacheLoader = CallbackCacheLoader;
