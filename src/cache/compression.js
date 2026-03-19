"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decompress = decompress;
exports.compressSqlite = compressSqlite;
exports.legacybz2 = legacybz2;
exports.legacyGzip = legacyGzip;
const xtea_1 = require("../libs/xtea");
//decompress data as it comes from the server
function decompress(input, key) {
    switch (input.readUInt8(0x0)) {
        case 0:
            return _uncompressed(input);
        case 1:
            return _bz2(input);
        case 2:
            return _zlib(input, key);
        case 3:
            return _lzma(input);
        case 0x5a: //0x5a4c4201
            return _zlibSqlite(input);
        default:
            throw new Error("Unknown compression type (" + input.readUInt8(0x0).toString() + ")");
    }
}
//compress data to use in sqlite BLOBs
function compressSqlite(input, compression) {
    switch (compression) {
        case "zlib":
            return _zlibSqliteCompress(input);
        default:
            throw new Error(`unknown compression type ${compression}`);
    }
}
/**
 * @param {Buffer} input The input buffer straight from the server
 */
var _uncompressed = function (input) {
    var size = input.readUInt32BE(0x1);
    var output = Buffer.alloc(size);
    input.copy(output, 0x0, 0x5);
    return output;
};
/**
 * @param {Buffer} input The input buffer straight from the server
 */
var _bz2 = function (input) {
    //var bzip2 = require("bzip2");
    var bzip2 = require("../libs/bzip2fork");
    var compressed = input.readUInt32BE(0x1);
    var uncompressed = input.readUInt32BE(0x5);
    var processed = Buffer.alloc(compressed + 0x2 + 0x1 + 0x1);
    input.copy(processed, 0x4, 0x9);
    // Add the header
    processed.writeUInt16BE(0x425A, 0x0); // Magic Number
    processed.writeUInt8(0x68, 0x2); // Version
    // processed.writeUInt8(Math.ceil(uncompressed / (1024 * 102.4)) + 0x30, 0x3); // Block size in 100kB because why the hell not
    processed.writeUInt8(8 + 0x30, 0x3); // the lib expects a number between 1-9 here (+0x30)
    return Buffer.from(bzip2.simple(bzip2.array(processed)));
};
function legacybz2(input) {
    var bzip2 = require("../libs/bzip2fork");
    var processed = Buffer.alloc(input.byteLength + 0x4);
    input.copy(processed, 0x4);
    // Add the header
    processed.writeUInt16BE(0x425A, 0x0); // Magic Number
    processed.writeUInt8(0x68, 0x2); // Version
    // processed.writeUInt8(Math.ceil(uncompressed / (1024 * 102.4)) + 0x30, 0x3); // Block size in 100kB because why the hell not
    processed.writeUInt8(8 + 0x30, 0x3); // the lib expects a number between 1-9 here (+0x30)
    return Buffer.from(bzip2.simple(bzip2.array(processed)));
}
/**
 * @param {Buffer} input The input buffer straight from the server
 */
var _zlib = function (input, key) {
    var zlib = require("zlib");
    try {
        let compressedsize = input.readUint32BE(1);
        if (key) {
            let compressedData = (0, xtea_1.simplexteadecrypt)(input.slice(5, 5 + 4 + compressedsize), key);
            return zlib.gunzipSync(compressedData.slice(4, 4 + compressedsize));
        }
        else {
            let compressedData = input.slice(9, 9 + compressedsize);
            return zlib.gunzipSync(compressedData);
        }
    }
    catch (e) {
        throw new Error(`gzip decompress failed, possibly due to missing or wrong xtea key, key: ${key ?? "none"}`, { cause: e });
    }
};
function legacyGzip(input) {
    var zlib = require("zlib");
    return zlib.gunzipSync(input);
}
let nativelzma = null;
let nativelzmaAttempted = false;
/**
 * @param {Buffer} input The input buffer straight from the server
 */
var _lzma = function (input) {
    var compressed = input.readUInt32BE(0x1);
    var uncompressed = input.readUInt32BE(0x5);
    var processed = Buffer.alloc(compressed + 8);
    input.copy(processed, 0x0, 0x9, 0xE);
    processed.writeUInt32LE(uncompressed, 0x5);
    processed.writeUInt32LE(0, 0x5 + 0x4);
    input.copy(processed, 0xD, 0xE);
    if (!nativelzmaAttempted && !nativelzma) {
        nativelzmaAttempted = true;
        try {
            nativelzma = __non_webpack_require__("lzma-native").LZMA();
        }
        catch (e) {
            console.log("can't load native lzma, falling back to naive js implementation");
        }
    }
    if (nativelzma) {
        return nativelzma.decompress(processed);
    }
    else {
        //need to do this weird import directly because of webpack
        //this lib also seems set "self.onMessage" when in a worker, but doesn't seem to collide with the messages we send
        var lzma = require("lzma/src/lzma_worker.js").LZMA;
        return Buffer.from(lzma.decompress(processed));
    }
};
function _zlibSqlite(input) {
    //skip header bytes 5a4c4201
    var uncompressed_size = input.readUInt32BE(0x4);
    var zlib = require("zlib");
    return zlib.inflateSync(input.slice(0x8));
}
function _zlibSqliteCompress(input) {
    const zlib = require("zlib");
    let compressbytes = zlib.deflateSync(input);
    let result = Buffer.alloc(4 + 4 + compressbytes.byteLength);
    result.write("5a4c4201", 0x0, "hex");
    result.writeUInt32BE(input.byteLength, 0x4);
    compressbytes.copy(result, 0x8);
    return result;
}
