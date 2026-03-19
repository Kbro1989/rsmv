"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadParams = loadParams;
exports.loadEnum = loadEnum;
exports.getEnumIntPairs = getEnumIntPairs;
exports.loadStruct = loadStruct;
exports.getEnumInt = getEnumInt;
exports.getEnumString = getEnumString;
exports.getStructInt = getStructInt;
exports.getStructString = getStructString;
const constants_1 = require("../constants");
const opdecoder_1 = require("../opdecoder");
async function loadParams(source) {
    let paramindex = await source.getArchiveById(constants_1.cacheMajors.config, constants_1.cacheConfigPages.params);
    let parammeta = new Map();
    for (let file of paramindex) {
        parammeta.set(file.fileid, opdecoder_1.parse.params.read(file.buffer, source));
    }
    return parammeta;
}
async function loadEnum(source, id) {
    return opdecoder_1.parse.enums.read(await source.getFileById(constants_1.cacheMajors.enums, id), source);
}
function getEnumIntPairs(enumjson) {
    return (enumjson.intArrayValue1 ?? enumjson.intArrayValue2?.values);
}
async function loadStruct(source, structid) {
    return opdecoder_1.parse.structs.read(await source.getFileById(constants_1.cacheMajors.structs, structid), source);
}
function getEnumInt(enumjson, key) {
    //TODO changed from -1 to 0 default backup
    return (enumjson.intArrayValue1 ?? enumjson.intArrayValue2?.values)?.find(q => q[0] == key)?.[1] ?? enumjson.intValue ?? 0;
}
function getEnumString(enumjson, key) {
    return (enumjson.stringArrayValue1 ?? enumjson.stringArrayValue2?.values)?.find(q => q[0] == key)?.[1] ?? enumjson.stringValue ?? "";
}
function getStructInt(paramtable, struct, paramid) {
    let parammeta = paramtable.get(paramid);
    if (!parammeta) {
        throw new Error(`unkown param ${paramid}`);
    }
    let match = struct?.extra?.find(q => q.prop == paramid);
    if (!match) {
        return parammeta.type?.defaultint ?? -1;
    }
    if (match.intvalue == undefined) {
        throw new Error("param is not of type int");
    }
    return match.intvalue;
}
function getStructString(paramtable, struct, paramid) {
    let parammeta = paramtable.get(paramid);
    if (!parammeta) {
        throw new Error(`unkown param ${paramid}`);
    }
    let match = struct?.extra?.find(q => q.prop == paramid);
    if (!match) {
        return parammeta.type?.defaultstring ?? "";
    }
    if (match.stringvalue == undefined) {
        throw new Error("param is not of type string");
    }
    return match.stringvalue;
}
