"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheFileDecodeModes = exports.cacheFileDecodeGroups = exports.cacheFileJsonModes = void 0;
const constants_1 = require("../constants");
const opdecoder_1 = require("../opdecoder");
const cache_1 = require("../cache");
const utils_1 = require("../utils");
const json_stringify_pretty_compact_1 = __importDefault(require("json-stringify-pretty-compact"));
const sprite_1 = require("../3d/sprite");
const imgutils_1 = require("../imgutils");
const modeltothree_1 = require("../3d/modeltothree");
const textures_1 = require("../3d/textures");
const musictrack_1 = require("./musictrack");
const legacycache_1 = require("../cache/legacycache");
const classicloader_1 = require("../cache/classicloader");
const rendercutscene_1 = require("./rendercutscene");
const renderrsinterface_1 = require("./renderrsinterface");
const clientscript_1 = require("../clientscript");
const fontmetrics_1 = require("./fontmetrics");
async function filerange(source, startindex, endindex) {
    if (startindex.major != endindex.major) {
        throw new Error("range must span one major");
    }
    let files = [];
    if (source.getBuildNr() <= constants_1.lastLegacyBuildnr) {
        //dummy filerange since we don't have an index
        let itercount = 0;
        for (let minor = startindex.minor; minor <= endindex.minor; minor++) {
            if (itercount++ > 1000) {
                break;
            }
            try {
                //bit silly since we download the files and then only return their ids
                //however it doesn't matter that much since the entire cache is <20mb
                let group = [];
                group = await source.getArchiveById(startindex.major, minor);
                let groupindex = {
                    major: startindex.major,
                    minor,
                    crc: 0,
                    name: null,
                    subindexcount: group.length,
                    subindices: group.map(q => q.fileid),
                    subnames: group.map(q => q.fileid),
                    version: 0
                };
                for (let sub of group) {
                    if (sub.fileid >= startindex.subid && sub.fileid <= endindex.subid) {
                        files.push({
                            index: groupindex,
                            subindex: sub.fileid
                        });
                    }
                }
            }
            catch {
                //omit missing groups from listing
            }
        }
    }
    else {
        let indexfile = await source.getCacheIndex(startindex.major);
        for (let index of indexfile) {
            if (!index) {
                continue;
            }
            if (index.minor >= startindex.minor && index.minor <= endindex.minor) {
                for (let fileindex = 0; fileindex < index.subindices.length; fileindex++) {
                    let subfileid = index.subindices[fileindex];
                    if (index.minor == startindex.minor && subfileid < startindex.subid) {
                        continue;
                    }
                    if (index.minor == endindex.minor && subfileid > endindex.subid) {
                        continue;
                    }
                    files.push({ index, subindex: fileindex });
                }
            }
        }
    }
    return files;
}
const throwOnNonSimple = {
    prepareDump() { },
    prepareWrite() { },
    write(b) { throw new Error("write not supported"); },
    combineSubs(b) { throw new Error("batch output mode not supported"); }
};
function oldWorldmapIndex(key) {
    return {
        major: constants_1.cacheMajors.mapsquares,
        minor: undefined,
        logicalDimensions: 2,
        usesArchieves: false,
        fileToLogical(source, major, minor, subfile) {
            return [255, minor];
        },
        logicalToFile(source, id) {
            throw new Error("not implemented");
        },
        async logicalRangeToFiles(source, start, end) {
            let index = await source.getCacheIndex(constants_1.cacheMajors.mapsquares);
            let res = [];
            for (let x = start[0]; x <= Math.min(end[0], 100); x++) {
                for (let z = start[1]; z <= Math.min(end[1], 200); z++) {
                    let namehash = (0, utils_1.cacheFilenameHash)(`${key}${x}_${z}`, source.getBuildNr() <= constants_1.lastLegacyBuildnr);
                    let file = index.find(q => q.name == namehash);
                    if (file) {
                        res.push({ index: file, subindex: 0 });
                    }
                }
            }
            return res;
        }
    };
}
function worldmapIndex(subfile) {
    const major = constants_1.cacheMajors.mapsquares;
    const worldStride = 128;
    return {
        major,
        minor: undefined,
        logicalDimensions: 2,
        usesArchieves: true,
        fileToLogical(source, major, minor, subfile) {
            return [minor % worldStride, Math.floor(minor / worldStride)];
        },
        logicalToFile(source, id) {
            return { major, minor: id[0] + id[1] * worldStride, subid: subfile };
        },
        async logicalRangeToFiles(source, start, end) {
            let indexfile = await source.getCacheIndex(major);
            let files = [];
            for (let index of indexfile) {
                if (!index) {
                    continue;
                }
                let x = index.minor % worldStride;
                let z = Math.floor(index.minor / worldStride);
                if (x >= start[0] && x <= end[0] && z >= start[1] && z <= end[1]) {
                    for (let fileindex = 0; fileindex < index.subindices.length; fileindex++) {
                        let subfileid = index.subindices[fileindex];
                        if (subfileid == subfile) {
                            files.push({ index, subindex: fileindex });
                        }
                    }
                }
            }
            return files;
        }
    };
}
function singleMinorIndex(major, minor) {
    return {
        major,
        minor,
        logicalDimensions: 1,
        usesArchieves: true,
        fileToLogical(source, major, minor, subfile) {
            return [subfile];
        },
        logicalToFile(source, id) {
            return { major, minor, subid: id[0] };
        },
        async logicalRangeToFiles(source, start, end) {
            return filerange(source, { major, minor, subid: start[0] }, { major, minor, subid: end[0] });
        }
    };
}
function chunkedIndex(major) {
    return {
        major,
        minor: undefined,
        logicalDimensions: 1,
        usesArchieves: true,
        fileToLogical(source, major, minor, subfile) {
            return [(0, cache_1.archiveToFileId)(major, minor, subfile)];
        },
        logicalToFile(source, id) {
            return (0, cache_1.fileIdToArchiveminor)(major, id[0], source.getBuildNr());
        },
        async logicalRangeToFiles(source, start, end) {
            let startindex = (0, cache_1.fileIdToArchiveminor)(major, start[0], source.getBuildNr());
            let endindex = (0, cache_1.fileIdToArchiveminor)(major, end[0], source.getBuildNr());
            return filerange(source, startindex, endindex);
        }
    };
}
function anyFileIndex() {
    return {
        major: undefined,
        minor: undefined,
        logicalDimensions: 3,
        usesArchieves: true,
        fileToLogical(source, major, minor, subfile) { return [major, minor, subfile]; },
        logicalToFile(source, id) { return { major: id[0], minor: id[1], subid: id[2] }; },
        async logicalRangeToFiles(source, start, end) {
            if (start[0] != end[0]) {
                throw new Error("can only do one major at a time");
            }
            let major = start[0];
            return filerange(source, { major, minor: start[1], subid: start[2] }, { major, minor: end[1], subid: end[2] });
        }
    };
}
function noArchiveIndex(major) {
    return {
        major,
        minor: undefined,
        logicalDimensions: 1,
        usesArchieves: false,
        fileToLogical(source, major, minor, subfile) { if (subfile != 0) {
            throw new Error("nonzero subfile in noarch index");
        } return [minor]; },
        logicalToFile(source, id) { return { major, minor: id[0], subid: 0 }; },
        async logicalRangeToFiles(source, start, end) {
            return filerange(source, { major, minor: start[0], subid: 0 }, { major, minor: end[0], subid: 0 });
        }
    };
}
function standardIndex(major) {
    return {
        major,
        minor: undefined,
        logicalDimensions: 2,
        usesArchieves: true,
        fileToLogical(source, major, minor, subfile) { return [minor, subfile]; },
        logicalToFile(source, id) { return { major, minor: id[0], subid: id[1] }; },
        async logicalRangeToFiles(source, start, end) {
            return filerange(source, { major, minor: start[0], subid: start[1] }, { major, minor: end[0], subid: end[1] });
        }
    };
}
function blacklistIndex(parent, blacklist) {
    return {
        ...parent,
        async logicalRangeToFiles(source, start, end) {
            let res = await parent.logicalRangeToFiles(source, start, end);
            return res.filter(q => !blacklist.some(w => w.major == q.index.major && w.minor == q.index.minor));
        },
    };
}
function indexfileIndex() {
    return {
        major: constants_1.cacheMajors.index,
        minor: undefined,
        logicalDimensions: 1,
        usesArchieves: false,
        fileToLogical(source, major, minor, subfile) { return [minor]; },
        logicalToFile(source, id) { return { major: constants_1.cacheMajors.index, minor: id[0], subid: 0 }; },
        async logicalRangeToFiles(source, start, end) {
            let indices = await source.getCacheIndex(constants_1.cacheMajors.index);
            return indices
                .filter(index => index && index.minor >= start[0] && index.minor <= end[0])
                .map(index => ({ index, subindex: 0 }));
        }
    };
}
function rootindexfileIndex() {
    return {
        major: constants_1.cacheMajors.index,
        minor: 255,
        logicalDimensions: 0,
        usesArchieves: false,
        fileToLogical(source, major, minor, subfile) { return []; },
        logicalToFile(source, id) { return { major: constants_1.cacheMajors.index, minor: 255, subid: 0 }; },
        async logicalRangeToFiles(source, start, end) {
            return [
                { index: { major: 255, minor: 255, crc: 0, size: 0, version: 0, name: null, subindexcount: 1, subindices: [0], subnames: null }, subindex: 0 }
            ];
        }
    };
}
function standardFile(parser, lookup, prepareDump, prepareParser) {
    let constr = (args) => {
        let singleschemaurl = "";
        let batchschemaurl = "";
        return {
            ...lookup,
            ext: "json",
            parser: parser,
            async prepareDump(output, source) {
                await prepareParser?.(source);
                await prepareDump?.(source);
                let name = Object.entries(exports.cacheFileDecodeModes).find(q => q[1] == constr);
                if (!name) {
                    throw new Error();
                }
                let schema = parser.parser.getJsonSchema();
                //need seperate files since vscode doesn't seem to support hastag paths in the uri
                if (args.batched == "true") {
                    let batchschema = {
                        type: "object",
                        properties: {
                            files: { type: "array", items: schema }
                        }
                    };
                    let relurl = `.schema-${name[0]}_batch.json`;
                    output.writeFile(relurl, (0, json_stringify_pretty_compact_1.default)(batchschema));
                    batchschemaurl = relurl;
                }
                else {
                    let relurl = `.schema-${name[0]}.json`;
                    output.writeFile(relurl, (0, json_stringify_pretty_compact_1.default)(schema));
                    singleschemaurl = relurl;
                }
            },
            prepareWrite(source) {
                return prepareParser?.(source);
            },
            read(b, id, source) {
                let obj = parser.read(b, source, { keepbuffers: args.keepbuffers });
                if (args.batched) {
                    obj.$fileid = (id.length == 1 ? id[0] : id);
                }
                else {
                    obj.$schema = singleschemaurl;
                }
                return (0, json_stringify_pretty_compact_1.default)(obj);
            },
            write(b, id, source) {
                return parser.write(JSON.parse(b.toString("utf8")), source.getDecodeArgs());
            },
            combineSubs(b) {
                return `{"$schema":"${batchschemaurl}","files":[\n\n${b.join("\n,\n\n")}]}`;
            },
            description: "View the JSON representation of a file",
            flagtemplate: {
                keepbuffers: { text: "Keep binary buffers (can be very large)", type: "boolean" }
            }
        };
    };
    return constr;
}
const decodeBinary = () => {
    return {
        ...anyFileIndex(),
        ext: "bin",
        prepareDump() { },
        prepareWrite() { },
        read(b) { return b; },
        write(b) { return b; },
        combineSubs(b) { return Buffer.concat(b); },
        description: "Outputs the raw files as they are in the cache"
    };
};
const decodeMusic = () => {
    return {
        ext: "ogg",
        major: constants_1.cacheMajors.music,
        minor: undefined,
        logicalDimensions: 1,
        usesArchieves: false,
        fileToLogical(source, major, minor, subfile) { return [minor]; },
        logicalToFile(source, id) { return { major: constants_1.cacheMajors.music, minor: id[0], subid: 0 }; },
        async logicalRangeToFiles(source, start, end) {
            let enumfile = await source.getFileById(constants_1.cacheMajors.enums, 1351);
            let enumdata = opdecoder_1.parse.enums.read(enumfile, source);
            let indexfile = await source.getCacheIndex(constants_1.cacheMajors.music);
            return enumdata.intArrayValue2.values
                .filter(q => q[1] >= start[0] && q[1] <= end[0])
                .sort((a, b) => a[1] - b[1])
                .filter((q, i, arr) => i == 0 || arr[i - 1][1] != q[1]) //filter duplicates
                .map(q => ({ index: indexfile[q[1]], subindex: 0 }));
        },
        ...throwOnNonSimple,
        read(buf, fileid, source) {
            return (0, musictrack_1.parseMusic)(source, constants_1.cacheMajors.music, fileid[0], buf, true);
        },
        description: "Stitches child music fragments onto header fragments, only a small number of music fragments are header fragments, ids that lead to child fragments are ignored."
    };
};
const decodeSound = (major, allowdownload) => () => {
    return {
        ext: "ogg",
        ...noArchiveIndex(major),
        ...throwOnNonSimple,
        read(buf, fileid, source) {
            return (0, musictrack_1.parseMusic)(source, major, fileid[0], buf, allowdownload);
        },
        description: "Extracts sound files from cache"
    };
};
const decodeCutscene = () => {
    return {
        ext: "html",
        ...noArchiveIndex(constants_1.cacheMajors.cutscenes),
        ...throwOnNonSimple,
        async read(buf, fileid, source) {
            let res = await (0, rendercutscene_1.renderCutscene)(source, buf);
            return res.doc;
        },
        description: "Decodes and assembles 2d vector cutscenes (first added in 2023). These cutscenes are saved in cache without image compression so take a while to decode. Sounds effects might be missing if you use a local game cache since the game normally only downloads them on demand."
    };
};
const decodeInterface = () => {
    return {
        ext: "html",
        major: constants_1.cacheMajors.interfaces,
        minor: undefined,
        logicalDimensions: 1,
        usesArchieves: true,
        fileToLogical(source, major, minor, subfile) { if (subfile != 0) {
            throw new Error("subfile 0 expected");
        } return [minor]; },
        logicalToFile(source, id) { return { major: constants_1.cacheMajors.interfaces, minor: id[0], subid: 0 }; },
        async logicalRangeToFiles(source, start, end) {
            let indexfile = await source.getCacheIndex(constants_1.cacheMajors.interfaces);
            return indexfile.filter(q => q && q.minor >= start[0] && q.minor <= end[0]).map(q => ({ index: q, subindex: 0 }));
        },
        ...throwOnNonSimple,
        async read(buf, fileid, source) {
            let res = await (0, renderrsinterface_1.renderRsInterfaceHTML)(new renderrsinterface_1.UiRenderContext(source), fileid[0]);
            return res;
        },
        description: "Extracts an interface and converts the template to a html file. Model and scripts will be missing and therefore the result might be incomplete."
    };
};
const decodeInterface2 = () => {
    return {
        ext: "ui.json",
        major: constants_1.cacheMajors.interfaces,
        minor: undefined,
        logicalDimensions: 1,
        usesArchieves: true,
        fileToLogical(source, major, minor, subfile) { if (subfile != 0) {
            throw new Error("subfile 0 expected");
        } return [minor]; },
        logicalToFile(source, id) { return { major: constants_1.cacheMajors.interfaces, minor: id[0], subid: 0 }; },
        async logicalRangeToFiles(source, start, end) {
            let indexfile = await source.getCacheIndex(constants_1.cacheMajors.interfaces);
            return indexfile.filter(q => q && q.minor >= start[0] && q.minor <= end[0]).map(q => ({ index: q, subindex: 0 }));
        },
        ...throwOnNonSimple,
        async read(buf, fileid, source) {
            return JSON.stringify({ id: fileid[0] });
        },
        description: "Doesn't extract anything but invokes the built-in RSMV interface viewer."
    };
};
const fontViewer = () => {
    return {
        ext: "font.json",
        major: constants_1.cacheMajors.fontmetrics,
        minor: undefined,
        logicalDimensions: 1,
        usesArchieves: false,
        fileToLogical(source, major, minor, subfile) { if (subfile != 0) {
            throw new Error("subfile 0 expected");
        } return [minor]; },
        logicalToFile(source, id) { return { major: constants_1.cacheMajors.fontmetrics, minor: id[0], subid: 0 }; },
        async logicalRangeToFiles(source, start, end) {
            let indexfile = await source.getCacheIndex(constants_1.cacheMajors.fontmetrics);
            return indexfile.filter(q => q && q.minor >= start[0] && q.minor <= end[0]).map(q => ({ index: q, subindex: 0 }));
        },
        ...throwOnNonSimple,
        async read(buf, fileid, source) {
            return JSON.stringify(await (0, fontmetrics_1.loadFontMetrics)(source, buf, fileid[0], true));
        },
        description: "Opens the built-in font viewer. Does not support newer vector fonts"
    };
};
const decodeClientScript = (ops) => {
    return {
        ext: "ts",
        ...noArchiveIndex(constants_1.cacheMajors.clientscript),
        ...throwOnNonSimple,
        async prepareDump(out, source) {
            let calli = await (0, clientscript_1.prepareClientScript)(source);
            out.writeFile("tsconfig.json", JSON.stringify({ "compilerOptions": { "lib": [], "target": "ESNext" } }, undefined, "\t")); //tsconfig to make the folder a project
            out.writeFile("opcodes.d.ts", (0, clientscript_1.writeOpcodeFile)(calli));
            out.writeFile("clientvars.d.ts", (0, clientscript_1.writeClientVarFile)(calli));
        },
        read(buf, fileid, source) {
            return (0, clientscript_1.renderClientScript)(source, buf, fileid[0], ops.cs2relativecomps == "true", ops.cs2notypes == "true", ops.cs2intcasts == "true");
        },
        async write(file, fileid, source) {
            let obj = await (0, clientscript_1.compileClientScript)(source, file.toString("utf8"));
            let res = opdecoder_1.parse.clientscript.write(obj, source.getDecodeArgs());
            // throw new Error("exit dryrun");
            return res;
        },
        description: "Extracts clientscript VM code (cs2) and converts it to something that is typescript-compatible.",
        flagtemplate: {
            cs2relativecomps: { text: "Hide subcomponent ids (can't be compiled, but offers stable diffing)", type: "boolean" },
            cs2notypes: { text: "Don't output TS types (can't be compiled)", type: "boolean" },
            cs2intcasts: { text: "Explicit JS int32 casts during math (can't be compiled)", type: "boolean" }
        }
    };
};
const decodeClientScriptViewer = () => {
    return {
        ext: "cs2.json",
        ...noArchiveIndex(constants_1.cacheMajors.clientscript),
        ...throwOnNonSimple,
        async prepareDump(fs, source) {
            await (0, clientscript_1.prepareClientScript)(source);
        },
        read(buf, fileid, source) {
            return JSON.stringify(opdecoder_1.parse.clientscript.read(buf, source));
        },
        description: "Basic implementation of the clientscript VM (cs2). Can be used to debug programs and step through code."
    };
};
const decodeOldProcTexture = () => {
    return {
        ext: "png",
        ...singleMinorIndex(constants_1.cacheMajors.texturesOldPng, 0),
        ...throwOnNonSimple,
        async read(b, id, source) {
            let obj = opdecoder_1.parse.oldproctexture.read(b, source);
            let spritefile = await source.getFileById(constants_1.cacheMajors.sprites, obj.spriteid);
            let sprites = (0, sprite_1.parseSprite)(spritefile);
            if (sprites.length != 1) {
                throw new Error("exactly one subsprite expected");
            }
            return (0, imgutils_1.pixelsToImageFile)(sprites[0].img, "png", 1);
        },
        description: "Procedural textures are highly compressed textures used in early rshd."
    };
};
const decodeLegacySprite = (minor) => () => {
    return {
        ext: "png",
        ...singleMinorIndex(legacycache_1.legacyMajors.data, minor),
        ...throwOnNonSimple,
        async read(b, id, source) {
            let metafile = await source.findSubfileByName(legacycache_1.legacyMajors.data, minor, "INDEX.DAT");
            let img = (0, sprite_1.parseLegacySprite)(metafile.buffer, b);
            return (0, imgutils_1.pixelsToImageFile)(img.img, "png", 1);
        },
        description: "Textures from the 'legacy' era, very early rs2"
    };
};
const decodeSprite = (major) => () => {
    return {
        ext: "png",
        ...noArchiveIndex(major),
        ...throwOnNonSimple,
        read(b, id) {
            //TODO support subimgs
            return (0, imgutils_1.pixelsToImageFile)((0, sprite_1.parseSprite)(b)[0].img, "png", 1);
        },
        description: "Sprites are all images that are used in ui. The client stores sprites are uncompressed bitmaps. Currently only the first frame for multi-frame sprites is extracted."
    };
};
const decodeTexture = (major) => () => {
    return {
        ext: "png",
        ...noArchiveIndex(major),
        prepareDump() { },
        prepareWrite() { },
        read(b, id) {
            let p = new textures_1.ParsedTexture(b, false, true);
            return p.toImageData().then(q => (0, imgutils_1.pixelsToImageFile)(q, "png", 1));
        },
        write(b) { throw new Error("write not supported"); },
        combineSubs(b) {
            if (b.length != 1) {
                throw new Error("texture batching not supported");
            }
            return b[0];
        },
        description: "Textures are images that are wrapped around models to display colors are fine details."
    };
};
const decodeSpriteHash = () => {
    return {
        ext: "json",
        ...noArchiveIndex(constants_1.cacheMajors.sprites),
        ...throwOnNonSimple,
        async read(b, id) {
            let images = (0, sprite_1.parseSprite)(b);
            let str = "";
            for (let [sub, img] of images.entries()) {
                let hash = (0, sprite_1.spriteHash)(img.img);
                str += (str == "" ? "" : ",") + `{"id":${id[0]},"sub":${sub},"hash":${hash}}`;
            }
            return str;
        },
        combineSubs(b) { return "[" + b.join(",\n") + "]"; },
        description: "Used to efficiently compare images."
    };
};
const decodeFontHash = () => {
    return {
        ext: "json",
        ...noArchiveIndex(constants_1.cacheMajors.fontmetrics),
        ...throwOnNonSimple,
        async read(buf, id, source) {
            return JSON.stringify(await (0, fontmetrics_1.loadFontMetrics)(source, buf, id[0]));
        },
        combineSubs(b) { return "[" + b.join(",\n") + "]"; },
        description: "Used to efficiently compare fonts."
    };
};
const decodeMeshHash = () => {
    return {
        ext: "json",
        ...noArchiveIndex(constants_1.cacheMajors.models),
        ...throwOnNonSimple,
        read(b, id, source) {
            let model = opdecoder_1.parse.models.read(b, source);
            let meshhashes = (0, modeltothree_1.getModelHashes)(model, id[0]);
            return JSON.stringify(meshhashes);
        },
        combineSubs(b) { return "[" + b.filter(q => q).join(",\n") + "]"; },
        description: "Used to efficiently compare models."
    };
};
exports.cacheFileJsonModes = (0, utils_1.constrainedMap)()({
    framemaps: { parser: opdecoder_1.parse.framemaps, lookup: chunkedIndex(constants_1.cacheMajors.framemaps) },
    items: { parser: opdecoder_1.parse.item, lookup: chunkedIndex(constants_1.cacheMajors.items) },
    enums: { parser: opdecoder_1.parse.enums, lookup: chunkedIndex(constants_1.cacheMajors.enums) },
    npcs: { parser: opdecoder_1.parse.npc, lookup: chunkedIndex(constants_1.cacheMajors.npcs) },
    soundjson: { parser: opdecoder_1.parse.audio, lookup: blacklistIndex(standardIndex(constants_1.cacheMajors.sounds), [{ major: constants_1.cacheMajors.sounds, minor: 0 }]) },
    musicjson: { parser: opdecoder_1.parse.audio, lookup: blacklistIndex(standardIndex(constants_1.cacheMajors.music), [{ major: constants_1.cacheMajors.music, minor: 0 }]) },
    objects: { parser: opdecoder_1.parse.object, lookup: chunkedIndex(constants_1.cacheMajors.objects) },
    achievements: { parser: opdecoder_1.parse.achievement, lookup: chunkedIndex(constants_1.cacheMajors.achievements) },
    structs: { parser: opdecoder_1.parse.structs, lookup: chunkedIndex(constants_1.cacheMajors.structs) },
    sequences: { parser: opdecoder_1.parse.sequences, lookup: chunkedIndex(constants_1.cacheMajors.sequences) },
    spotanims: { parser: opdecoder_1.parse.spotAnims, lookup: chunkedIndex(constants_1.cacheMajors.spotanims) },
    materials: { parser: opdecoder_1.parse.materials, lookup: chunkedIndex(constants_1.cacheMajors.materials) },
    oldmaterials: { parser: opdecoder_1.parse.oldmaterials, lookup: singleMinorIndex(constants_1.cacheMajors.materials, 0) },
    quickchatcats: { parser: opdecoder_1.parse.quickchatCategories, lookup: singleMinorIndex(constants_1.cacheMajors.quickchat, 0) },
    quickchatlines: { parser: opdecoder_1.parse.quickchatLines, lookup: singleMinorIndex(constants_1.cacheMajors.quickchat, 1) },
    dbtables: { parser: opdecoder_1.parse.dbtables, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.dbtables) },
    dbrows: { parser: opdecoder_1.parse.dbrows, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.dbrows) },
    overlays: { parser: opdecoder_1.parse.mapsquareOverlays, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.mapoverlays) },
    identitykit: { parser: opdecoder_1.parse.identitykit, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.identityKit) },
    params: { parser: opdecoder_1.parse.params, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.params) },
    underlays: { parser: opdecoder_1.parse.mapsquareUnderlays, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.mapunderlays) },
    mapscenes: { parser: opdecoder_1.parse.mapscenes, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.mapscenes) },
    environments: { parser: opdecoder_1.parse.environments, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.environments) },
    animgroupconfigs: { parser: opdecoder_1.parse.animgroupConfigs, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.animgroups) },
    maplabels: { parser: opdecoder_1.parse.maplabels, lookup: singleMinorIndex(constants_1.cacheMajors.config, constants_1.cacheConfigPages.maplabels) },
    mapzones: { parser: opdecoder_1.parse.mapZones, lookup: singleMinorIndex(constants_1.cacheMajors.worldmap, 0) },
    cutscenes: { parser: opdecoder_1.parse.cutscenes, lookup: noArchiveIndex(constants_1.cacheMajors.cutscenes) },
    particles0: { parser: opdecoder_1.parse.particles_0, lookup: singleMinorIndex(constants_1.cacheMajors.particles, 0) },
    particles1: { parser: opdecoder_1.parse.particles_1, lookup: singleMinorIndex(constants_1.cacheMajors.particles, 1) },
    maptiles: { parser: opdecoder_1.parse.mapsquareTiles, lookup: worldmapIndex(constants_1.cacheMapFiles.squares) },
    maptiles_nxt: { parser: opdecoder_1.parse.mapsquareTilesNxt, lookup: worldmapIndex(constants_1.cacheMapFiles.square_nxt) },
    maplocations: { parser: opdecoder_1.parse.mapsquareLocations, lookup: worldmapIndex(constants_1.cacheMapFiles.locations) },
    mapenvs: { parser: opdecoder_1.parse.mapsquareEnvironment, lookup: worldmapIndex(constants_1.cacheMapFiles.env) },
    maptiles_old: { parser: opdecoder_1.parse.mapsquareTiles, lookup: oldWorldmapIndex("m") },
    maplocations_old: { parser: opdecoder_1.parse.mapsquareLocations, lookup: oldWorldmapIndex("l") },
    frames: { parser: opdecoder_1.parse.frames, lookup: standardIndex(constants_1.cacheMajors.frames) },
    models: { parser: opdecoder_1.parse.models, lookup: noArchiveIndex(constants_1.cacheMajors.models) },
    oldmodels: { parser: opdecoder_1.parse.oldmodels, lookup: noArchiveIndex(constants_1.cacheMajors.oldmodels) },
    skeletons: { parser: opdecoder_1.parse.skeletalAnim, lookup: noArchiveIndex(constants_1.cacheMajors.skeletalAnims) },
    proctextures: { parser: opdecoder_1.parse.proctexture, lookup: noArchiveIndex(constants_1.cacheMajors.texturesOldPng) },
    oldproctextures: { parser: opdecoder_1.parse.oldproctexture, lookup: singleMinorIndex(constants_1.cacheMajors.texturesOldPng, 0) },
    interfaces: { parser: opdecoder_1.parse.interfaces, lookup: standardIndex(constants_1.cacheMajors.interfaces) },
    fontmetrics: { parser: opdecoder_1.parse.fontmetrics, lookup: standardIndex(constants_1.cacheMajors.fontmetrics) },
    classicmodels: { parser: opdecoder_1.parse.classicmodels, lookup: singleMinorIndex(0, classicloader_1.classicGroups.models) },
    indices: { parser: opdecoder_1.parse.cacheIndex, lookup: indexfileIndex() },
    rootindex: { parser: opdecoder_1.parse.rootCacheIndex, lookup: rootindexfileIndex() },
    test: { parser: opdecoder_1.FileParser.fromJson(`["struct",\n  \n]`), lookup: anyFileIndex() },
    clientscriptops: { parser: opdecoder_1.parse.clientscript, lookup: noArchiveIndex(constants_1.cacheMajors.clientscript), prepareParser: source => (0, clientscript_1.prepareClientScript)(source).then(() => undefined) },
});
const npcmodels = function () {
    return {
        ...chunkedIndex(constants_1.cacheMajors.npcs),
        ext: "json",
        prepareDump(output) { },
        prepareWrite() { },
        read(b, id, source) {
            let obj = opdecoder_1.parse.npc.read(b, source);
            return (0, json_stringify_pretty_compact_1.default)({
                id: id[0],
                size: obj.boundSize ?? 1,
                name: obj.name ?? "",
                models: obj.models ?? []
            });
        },
        write(files) {
            throw new Error("");
        },
        combineSubs(b) {
            return `[${b.join(",\n")}]`;
        },
        description: "Extract model metadata from npc configs."
    };
};
const cacheFileDecodersImage = (0, utils_1.constrainedMap)()({
    sprites: decodeSprite(constants_1.cacheMajors.sprites),
    textures_dds: decodeTexture(constants_1.cacheMajors.texturesDds),
    textures_png: decodeTexture(constants_1.cacheMajors.texturesPng),
    textures_bmp: decodeTexture(constants_1.cacheMajors.texturesBmp),
    textures_ktx: decodeTexture(constants_1.cacheMajors.texturesKtx)
});
const cacheFileDecodersLegacyImage = (0, utils_1.constrainedMap)()({
    legacy_sprites: decodeLegacySprite(legacycache_1.legacyGroups.sprites),
    legacy_textures: decodeLegacySprite(legacycache_1.legacyGroups.textures),
    textures_proc: decodeOldProcTexture,
    textures_oldpng: decodeTexture(constants_1.cacheMajors.texturesOldPng),
    textures_2015png: decodeTexture(constants_1.cacheMajors.textures2015Png),
    textures_2015dds: decodeTexture(constants_1.cacheMajors.textures2015Dds),
    textures_2015pngmips: decodeTexture(constants_1.cacheMajors.textures2015PngMips),
    textures_2015compoundpng: decodeTexture(constants_1.cacheMajors.textures2015CompoundPng),
    textures_2015compounddds: decodeTexture(constants_1.cacheMajors.textures2015CompoundDds),
    textures_2015compoundpngmips: decodeTexture(constants_1.cacheMajors.textures2015CompoundPngMips),
});
const cacheFileDecodersSound = (0, utils_1.constrainedMap)()({
    sounds: decodeSound(constants_1.cacheMajors.sounds, true),
    musicfragments: decodeSound(constants_1.cacheMajors.music, false),
    music: decodeMusic,
});
const cacheFileDecodersInteractive = (0, utils_1.constrainedMap)()({
    cutscenehtml: decodeCutscene,
    interfacehtml: decodeInterface,
    interfaceviewer: decodeInterface2,
    fontviewer: fontViewer,
    clientscript: decodeClientScript,
    clientscriptviewer: decodeClientScriptViewer,
});
const cacheFileDecodersOther = (0, utils_1.constrainedMap)()({
    bin: decodeBinary,
    spritehash: decodeSpriteHash,
    fonthash: decodeFontHash,
    modelhash: decodeMeshHash,
    npcmodels: npcmodels,
});
const cacheFileDecodersJson = Object.fromEntries(Object.entries(exports.cacheFileJsonModes)
    .map(([k, v]) => [k, standardFile(v.parser, v.lookup, v.prepareDump, v.prepareParser)]));
exports.cacheFileDecodeGroups = {
    image: cacheFileDecodersImage,
    legacyImage: cacheFileDecodersLegacyImage,
    interactive: cacheFileDecodersInteractive,
    sound: cacheFileDecodersSound,
    other: cacheFileDecodersOther,
    json: cacheFileDecodersJson,
};
exports.cacheFileDecodeModes = Object.fromEntries(Object.values(exports.cacheFileDecodeGroups).flatMap(q => Object.entries(q)));
