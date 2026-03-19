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
exports.ClientscriptObfuscation = exports.OpcodeInfo = void 0;
exports.getArgType = getArgType;
exports.getReturnType = getReturnType;
const constants_1 = require("../constants");
const opdecoder_1 = require("../opdecoder");
const utils_1 = require("../utils");
const openrs2loader_1 = require("../cache/openrs2loader");
const fs = __importStar(require("fs/promises"));
const crc32util_1 = require("../libs/crc32util");
const definitions_1 = require("./definitions");
const rshashnames_1 = require("../libs/rshashnames");
const ast_1 = require("./ast");
const subtypedetector_1 = require("./subtypedetector");
const datastore = __importStar(require("idb-keyval"));
const util_1 = require("./util");
const detectableImmediates = ["byte", "int", "tribyte", "switch"];
const lastNonObfuscatedBuild = 668;
const firstModernOpsBuild = 751;
//TODO move to file
let varInfoParser = new opdecoder_1.FileParser({
    "0x03": { "name": "type", "read": "ubyte" },
    "0x04": { "name": "0x04", "read": "ubyte" },
    "0x07": { "name": "0x07", "read": true },
    "0x6e": { "name": "0x6e", "read": "ushort" },
});
var varbitInfoParser = new opdecoder_1.FileParser({
    "0x01": { "name": "varid", "read": "utribyte" }, //[8bit domain][16bit id] read as tribyte since thats also how we read pushvar/popvar imm
    "0x02": { "name": "bits", "read": ["tuple", "ubyte", "ubyte"] }
});
class OpcodeInfo {
    scrambledid;
    id;
    possibleTypes;
    type;
    stackinfo = new definitions_1.StackInOut();
    stackChangeConstraints = new Set();
    constructor(scrambledid, id, possibles) {
        this.scrambledid = scrambledid;
        this.id = id;
        this.possibleTypes = new Set(possibles);
        if (possibles.length == 1) {
            this.type = possibles[0];
        }
        else {
            this.type = "unknown";
        }
    }
    static fromJson(json) {
        let r = new OpcodeInfo(json.scrambledid, json.id, json.type == "unknown" ? detectableImmediates : [json.type]);
        r.stackinfo = definitions_1.StackInOut.fromJson(json.stackinfo);
        return r;
    }
    toJson() {
        return {
            id: this.id,
            scrambledid: this.scrambledid,
            stackinfo: this.stackinfo.toJson(),
            type: this.type
        };
    }
}
exports.OpcodeInfo = OpcodeInfo;
//only works for old caches before opcode obfuscation
function getClassicImmType(op) {
    //originally all <0x80 were ints
    //except several special cases
    let type = "byte";
    if (op == definitions_1.namedClientScriptOps.pushstring) {
        type = "string";
    }
    else if (op == definitions_1.namedClientScriptOps.pushlong) {
        type = "long";
    }
    else if (op == definitions_1.namedClientScriptOps.return) {
        type = "byte";
    }
    else if (op == 0x26) {
        type = "byte";
    }
    else if (op == 0x27) {
        type = "byte";
    }
    else if (op == 0x66) {
        type = "byte";
    }
    else if (op < 0x80) {
        type = "int";
    }
    return type;
}
function cannonicalOp(operation, buildnr, immtype) {
    let op = operation.opcode;
    let imm = operation.imm;
    let imm_obj = operation.imm_obj;
    if (op == definitions_1.namedClientScriptOps.pushint) {
        imm_obj = imm;
        op = definitions_1.namedClientScriptOps.pushconst;
        immtype = "switch";
        imm = 0;
    }
    if (op == definitions_1.namedClientScriptOps.pushlong) {
        imm_obj = imm_obj;
        op = definitions_1.namedClientScriptOps.pushconst;
        immtype = "switch";
        imm = 1;
    }
    if (op == definitions_1.namedClientScriptOps.pushstring) {
        imm_obj = imm_obj;
        op = definitions_1.namedClientScriptOps.pushconst;
        immtype = "switch";
        imm = 2;
    }
    if (buildnr < firstModernOpsBuild) {
        if (op == definitions_1.namedClientScriptOps.pushvar || op == definitions_1.namedClientScriptOps.popvar) {
            imm = (2 << 24) | (imm << 8);
        }
    }
    return { opcode: op, imm, imm_obj, immtype };
}
function isOpEqual(a, b) {
    if (a.opcode != b.opcode) {
        return false;
    }
    if (a.imm != b.imm) {
        //imm is allowed to differ, as the value is not between 0-10 and is relatively near
        if (Math.sign(a.imm) != Math.sign(b.imm)) {
            return false;
        }
        if (a.imm >= 0 && a.imm < 10) {
            return false;
        }
        if (b.imm >= 0 && b.imm < 10) {
            return false;
        }
        if (Math.abs(a.imm - b.imm) > Math.max(a.imm + b.imm) / 2 * 0.2 + 10) {
            return false;
        }
    }
    if (typeof a.imm_obj != typeof b.imm_obj) {
        return false;
    }
    if (Array.isArray(a.imm_obj)) {
        if (!Array.isArray(b.imm_obj)) {
            return false;
        }
        //bigints are allowed to differ
    }
    else if (typeof a.imm_obj == "string") {
        //string are allowed to differ
    }
    else if (typeof a.imm_obj == "number") {
        //int value
        if (Math.abs(a.imm - b.imm) > Math.max(a.imm + b.imm) / 2 * 0.2 + 10) {
            return false;
        }
    }
    else if (a.imm_obj != b.imm_obj) {
        return false;
    }
    return true;
}
function parseImm(buf, offset, type) {
    let imm = 0;
    let imm_obj = null;
    if (type == "byte") {
        if (buf.length < offset + 1) {
            return null;
        }
        imm = buf.readUint8(offset);
        offset += 1;
    }
    else if (type == "int") {
        if (buf.length < offset + 4) {
            return null;
        }
        imm = buf.readInt32BE(offset);
        offset += 4;
    }
    else if (type == "tribyte") {
        if (buf.length < offset + 3) {
            return null;
        }
        imm = buf.readUintBE(offset, 3);
        offset += 3;
    }
    else if (type == "switch") {
        if (buf.length < offset + 1) {
            return null;
        }
        let subtype = buf.readUint8(offset++);
        imm = subtype;
        if (subtype == 0) {
            if (buf.length < offset + 4) {
                return null;
            }
            imm_obj = buf.readInt32BE(offset);
            offset += 4;
        }
        else if (subtype == 1) {
            if (buf.length < offset + 8) {
                return null;
            }
            imm_obj = [
                buf.readUint32BE(offset),
                buf.readUint32BE(offset + 4),
            ];
            offset += 8;
        }
        else if (subtype == 2) {
            let end = offset;
            while (true) {
                if (end == buf.length) {
                    return null;
                }
                if (buf.readUInt8(end) == 0) {
                    break;
                }
                end++;
            }
            imm_obj = buf.toString("latin1", offset, end);
            offset = end + 1;
        }
    }
    else if (type == "string") {
        let end = offset;
        while (true) {
            if (end == buf.length) {
                return null;
            }
            if (buf.readUInt8(end) == 0) {
                break;
            }
            end++;
        }
        imm_obj = buf.toString("latin1", offset, end);
        offset = end + 1;
    }
    else if (type == "long") {
        if (buf.length < offset + 8) {
            return null;
        }
        imm_obj = [
            buf.readUint32BE(offset),
            buf.readUint32BE(offset + 4),
        ];
        offset += 8;
    }
    else {
        throw new Error("unknown imm type");
    }
    return {
        imm,
        imm_obj,
        offset
    };
}
let referenceOpcodeDump = null;
async function getReferenceOpcodeDump() {
    referenceOpcodeDump ??= (async () => {
        let rootcalli = await ClientscriptObfuscation.create(await openrs2loader_1.Openrs2CacheSource.fromId(1383)); //668 20 dec 2011
        let bounce1 = await ClientscriptObfuscation.create(await openrs2loader_1.Openrs2CacheSource.fromId(1572)); //932 16 oct 2023
        //add extra bounces when the gap is too large and non of the scripts match
        rootcalli.setNonObbedMappings();
        await bounce1.runCallibrationFrom(rootcalli.generateDump());
        return bounce1.generateDump();
    })();
    return referenceOpcodeDump;
}
class ClientscriptObfuscation {
    mappings = new Map();
    decodedMappings = new Map();
    isNonObbedCache = false;
    candidatesLoaded = false;
    foundEncodings = false;
    foundParameters = false;
    foundSubtypes = false;
    opidcounter = 10000;
    source;
    dbtables = new Map();
    varmeta = new Map();
    varbitmeta = new Map();
    parammeta = new Map();
    scriptargs = new Map();
    candidates = new Map();
    static async fromJson(source, deobjson, scriptjson) {
        if (deobjson.buildnr != source.getBuildNr()) {
            throw new Error("build numbers of json deob and loaded cache don't match");
        }
        let r = new ClientscriptObfuscation(source);
        for (let opjson of deobjson.mappings) {
            let op = OpcodeInfo.fromJson(opjson);
            r.mappings.set(op.scrambledid, op);
            r.decodedMappings.set(op.id, op);
        }
        r.opidcounter = deobjson.opidcounter;
        r.foundEncodings = true;
        await r.preloadData();
        if (scriptjson) {
            r.scriptargs = new Map(scriptjson.scriptargs.map(v => {
                return [v.id, {
                        scriptname: v.scriptname ?? "",
                        stack: definitions_1.StackInOut.fromJson(v.stack)
                    }];
            }));
        }
        else {
            await r.loadCandidates();
            r.parseCandidateContents();
            (0, subtypedetector_1.detectSubtypes)(r, r.candidates); //TODO is this needed?
        }
        return r;
    }
    toJson() {
        let r = {
            buildnr: this.source.getBuildNr(),
            mappings: [...this.mappings.values()].map(v => v.toJson()),
            opidcounter: this.opidcounter,
        };
        return r;
    }
    getScriptJson() {
        let r = {
            scriptargs: [...this.scriptargs].map(([k, v]) => ({ id: k, scriptname: v.scriptname, stack: v.stack.toJson() }))
        };
        return r;
    }
    static async getSaveName(source) {
        let index = await source.getCacheIndex(constants_1.cacheMajors.clientscript);
        let firstindex = index.find(q => q); //[0] might be undefined
        if (!firstindex) {
            throw new Error("cache has no clientscripts");
        }
        let firstscript = await source.getFileById(firstindex.major, firstindex.minor);
        let crc = (0, crc32util_1.crc32)(firstscript);
        let scripthash = 0;
        for (let i = 0; i < index.length; i++) {
            if (!index[i]) {
                continue;
            }
            scripthash = (0, crc32util_1.crc32addInt)(index[i].crc, scripthash);
        }
        return {
            opcodename: `opcodes-build${source.getBuildNr()}-${crc}.json`,
            scriptname: `scripts-build${source.getBuildNr()}-${scripthash}.json`
        };
    }
    async save() {
        let { opcodename, scriptname } = await ClientscriptObfuscation.getSaveName(this.source);
        let filedata = JSON.stringify(this.toJson());
        let scriptfiledata = JSON.stringify(this.getScriptJson());
        if (fs.constants) {
            await fs.mkdir("cache", { recursive: true });
            await fs.writeFile(`cache/${opcodename}`, filedata);
            await fs.writeFile(`cache/${scriptname}`, scriptfiledata);
        }
        else if (datastore.set) {
            await datastore.set(opcodename, filedata);
            await datastore.set(scriptname, scriptfiledata);
        }
        else {
            console.log(`did not save cs2 callibration since there is no fs and no browser indexeddb`);
        }
    }
    constructor(source) {
        this.source = source;
    }
    static async create(source, nocached = false) {
        //TODO merge fromjson and runautocallibrate into this to untangle weird logic and double-loading
        if (!nocached) {
            try {
                let { opcodename, scriptname } = await this.getSaveName(source);
                let file = undefined;
                let scriptfile = undefined;
                if (fs.constants) {
                    file = await fs.readFile(`cache/${opcodename}`, "utf8");
                    scriptfile = await fs.readFile(`cache/${scriptname}`, "utf8").catch(() => undefined);
                }
                else if (datastore.get) {
                    file = await datastore.get(opcodename);
                    scriptfile = await datastore.get(scriptname).catch(() => undefined);
                }
                if (file) {
                    let json = JSON.parse(file);
                    let scriptjson = (scriptfile ? JSON.parse(scriptfile) : null);
                    return this.fromJson(source, json, scriptjson);
                }
            }
            catch { }
        }
        let res = new ClientscriptObfuscation(source);
        globalThis.deob = res; //TODO remove
        await res.preloadData();
        await res.loadCandidates();
        return res;
    }
    declareOp(rawopid, types) {
        let op = new OpcodeInfo(rawopid, this.opidcounter++, types);
        if (this.mappings.has(rawopid)) {
            throw new Error("op already exists");
        }
        if (this.decodedMappings.has(op.id)) {
            throw new Error("allocated op id alerady exists");
        }
        this.mappings.set(rawopid, op);
        this.decodedMappings.set(op.id, op);
        return op;
    }
    async preloadData() {
        let loadVars = async (subid) => {
            let archieve = await this.source.getArchiveById(constants_1.cacheMajors.config, subid);
            let last = archieve.at(-1)?.fileid ?? 0;
            return { last, vars: new Map(archieve.map(q => [q.fileid, varInfoParser.read(q.buffer, this.source)])) };
        };
        let dbtables = await this.source.getArchiveById(constants_1.cacheMajors.config, constants_1.cacheConfigPages.dbtables);
        this.dbtables = new Map(dbtables.map(q => [q.fileid, opdecoder_1.parse.dbtables.read(q.buffer, this.source)]));
        //only tested on current 932 caches
        if (this.source.getBuildNr() > 900) {
            this.varmeta = new Map(await Promise.all(Object.entries(definitions_1.variableSources).map(async (q) => {
                let vardata = await loadVars(q[1].index);
                return [q[1].key, { name: q[0], vars: vardata.vars, maxid: vardata.last }];
            })));
            let varbitarchieve = await this.source.getArchiveById(constants_1.cacheMajors.config, constants_1.cacheConfigPages.varbits);
            this.varbitmeta = new Map(varbitarchieve.map(q => [q.fileid, varbitInfoParser.read(q.buffer, this.source)]));
            this.parammeta = await (0, util_1.loadParams)(this.source);
        }
    }
    async loadCandidates(idstart = 0, idend = 0xffffff) {
        let index = await this.source.getCacheIndex(constants_1.cacheMajors.clientscript);
        this.candidates.clear();
        let source = this.source;
        await (0, utils_1.trickleTasksTwoStep)(10, function* () {
            for (let entry of index) {
                if (!entry) {
                    continue;
                }
                if (entry.minor < idstart || entry.minor > idend) {
                    continue;
                }
                yield source.getFile(entry.major, entry.minor, entry.crc).then(buf => ({
                    id: entry.minor,
                    scriptname: rshashnames_1.reverseHashes.get(index[entry.minor].name) ?? "",
                    solutioncount: 0,
                    buf,
                    script: opdecoder_1.parse.clientscriptdata.read(buf, source),
                    scriptcontents: null,
                    argtype: null,
                    returnType: null,
                    unknowns: new Map(),
                    didmatch: false
                }));
            }
        }, q => this.candidates.set(q.id, q));
        this.candidatesLoaded = true;
    }
    parseCandidateContents() {
        if (!this.candidatesLoaded) {
            throw new Error("candidates not loaded");
        }
        if (!this.foundEncodings) {
            throw new Error("can't parse candidates because op encodings are not yet callibrated");
        }
        for (let cand of this.candidates.values()) {
            try {
                cand.scriptcontents ??= opdecoder_1.parse.clientscript.read(cand.buf, this.source, { clientScriptDeob: this });
            }
            catch (e) { }
            if (!cand.scriptcontents) {
                continue;
            }
            cand.returnType = getReturnType(this, cand.scriptcontents.opcodedata);
            cand.argtype = getArgType(cand.script);
            this.scriptargs.set(cand.id, {
                scriptname: cand.scriptname,
                stack: new definitions_1.StackInOut(cand.argtype.getArglist(), 
                //need to get rid of known stack order here since the runescript compiler doesn't adhere to it
                //known cases:
                // pop_intstring_discard order seems to not care about order
                cand.returnType.toStackDiff().getArglist())
            });
        }
    }
    generateDump() {
        let cands = this.candidates;
        let scripts = [];
        this.parseCandidateContents();
        for (let cand of cands.values()) {
            if (cand.scriptcontents) {
                scripts.push({ id: cand.id, scriptdata: cand.script, scriptops: cand.scriptcontents.opcodedata });
            }
        }
        console.log(`dumped ${scripts.length} /${cands.size} scripts`);
        return {
            buildnr: this.source.getBuildNr(),
            scripts,
            decodedMappings: this.decodedMappings,
            opidcounter: this.opidcounter
        };
    }
    async runAutoCallibrate(source) {
        if (source.getBuildNr() <= lastNonObfuscatedBuild) {
            this.setNonObbedMappings();
        }
        else if (!this.foundEncodings) {
            let ref = await getReferenceOpcodeDump();
            await this.runCallibrationFrom(ref);
        }
    }
    async runCallibrationFrom(refscript) {
        console.log(`callibrating buildnr ${this.source.getBuildNr()}`);
        copyOpcodesFrom(this, refscript);
        findOpcodeImmidiates(this);
        this.parseCandidateContents();
        callibrateOperants(this, this.candidates);
        // todo, somehow a extra runs still finds new types, these should have been caught in the first run
        callibrateOperants(this, this.candidates);
        callibrateOperants(this, this.candidates);
        callibrateOperants(this, this.candidates);
        try {
            (0, subtypedetector_1.detectSubtypes)(this, this.candidates);
        }
        catch (e) {
            console.log("subtype callibration failed, types info might not be accurate");
        }
    }
    // don't want them to be methods, use this to expose them to console
    findOpcodeImmidiates = findOpcodeImmidiates;
    callibrateOperants = callibrateOperants;
    callibrateSubtypes = subtypedetector_1.detectSubtypes;
    setNonObbedMappings() {
        this.foundEncodings = true;
        this.isNonObbedCache = true;
    }
    writeOpCode = (state, v) => {
        if (!this.foundEncodings) {
            throw new Error("clientscript deob not callibrated yet");
        }
        if (typeof v != "object" || !v) {
            throw new Error("opcode is expected to be an object");
        }
        if (!("opcode" in v) || typeof v.opcode != "number") {
            throw new Error("opcode prop expectec");
        }
        if (!("imm" in v) || typeof v.imm != "number") {
            throw new Error("imm prop expected");
        }
        let op = this.getNamedOp(v.opcode);
        state.buffer.writeUint16BE(op.scrambledid, state.scan);
        state.scan += 2;
        if (op.type == "byte") {
            state.buffer.writeUint8(v.imm, state.scan);
            state.scan++;
        }
        else if (op.type == "int") {
            state.buffer.writeInt32BE(v.imm, state.scan);
            state.scan += 4;
        }
        else if (op.type == "tribyte") {
            state.buffer.writeUIntBE(v.imm, state.scan, 3);
            state.scan += 3;
        }
        else if (op.type == "switch") {
            if (!("imm_obj" in v)) {
                throw new Error("imm_obj prop expected");
            }
            state.buffer.writeUInt8(v.imm, state.scan);
            state.scan++;
            if (v.imm == 0) {
                if (typeof v.imm_obj != "number") {
                    throw new Error("int expected");
                }
                state.buffer.writeInt32BE(v.imm_obj, state.scan);
                state.scan += 4;
            }
            else if (v.imm == 1) {
                if (!Array.isArray(v.imm_obj) || v.imm_obj.length != 2 || typeof v.imm_obj[0] != "number" || typeof v.imm_obj[1] != "number") {
                    throw new Error("array with 2 ints expected");
                }
                state.buffer.writeUInt32BE(v.imm_obj[0], state.scan + 0);
                state.buffer.writeUInt32BE(v.imm_obj[0], state.scan + 4);
                state.scan += 8;
            }
            else if (v.imm == 2) {
                if (typeof v.imm_obj != "string") {
                    throw new Error("string expected");
                }
                state.buffer.write(v.imm_obj, state.scan, "latin1");
                state.scan += v.imm_obj.length;
                state.buffer.writeUint8(0, state.scan);
                state.scan++;
            }
            else {
                throw new Error("unknown switch imm type " + v.imm);
            }
        }
        else {
            throw new Error("op type write not implemented " + op.type);
        }
    };
    readOpcode = (state) => {
        if (!this.foundEncodings) {
            throw new Error("clientscript deob not callibrated yet");
        }
        let opcode = state.buffer.readUint16BE(state.scan);
        state.scan += 2;
        let res = this.mappings.get(opcode);
        if (!res || res.type == "unknown") {
            if (this.isNonObbedCache) {
                res = new OpcodeInfo(opcode, opcode, [getClassicImmType(opcode)]);
                this.mappings.set(opcode, res);
                this.decodedMappings.set(opcode, res);
            }
            else {
                //TODO do this guess somewhere else
                // throw new Error("op type not resolved: 0x" + opcode.toString(16));
                if (res) {
                    res.type = "byte";
                    res.possibleTypes = new Set(res.type);
                }
                else {
                    res = this.declareOp(opcode, ["byte"]);
                }
                console.log(`op type not resolved: 0x${opcode.toString(16)} (opid:${res.id}), guessing imm type byte`);
            }
        }
        let imm = parseImm(state.buffer, state.scan, res.type);
        if (!imm) {
            throw new Error("failed to read immidiate");
        }
        state.scan = imm.offset;
        let opname = (0, definitions_1.getOpName)(res.id);
        return { opcode: res.id, imm: imm.imm, imm_obj: imm.imm_obj, opname };
    };
    getClientVarMeta(varint) {
        let groupid = (varint >> 24) & 0xff;
        let varid = (varint >> 8) & 0xffff;
        let group = this.varmeta.get(groupid);
        let varmeta = group?.vars.get(varid);
        if (!group || !varmeta) {
            return null;
        }
        let fulltype = varmeta.type;
        let type = (0, definitions_1.typeToPrimitive)(fulltype);
        return { name: group.name, varid, type, fulltype };
    }
    getNamedOp(id) {
        let opinfo = this.decodedMappings.get(id);
        if (!opinfo) {
            throw new Error(`op with named id ${id} not found`);
        }
        return opinfo;
    }
}
exports.ClientscriptObfuscation = ClientscriptObfuscation;
function copyOpcodesFrom(deob, refcalli) {
    let candidates = deob.candidates;
    let newbuildnr = deob.source.getBuildNr();
    deob.opidcounter = refcalli.opidcounter;
    let testCandidate = (cand, refops) => {
        if (cand.script.instructioncount != refops.length) {
            return false;
        }
        let unconfirmed = new Map();
        let offset = 0;
        let buf = cand.script.opcodedata;
        for (let i = 0; i < cand.script.instructioncount; i++) {
            let refopinfo = refcalli.decodedMappings.get(refops[i].opcode);
            if (!refopinfo || refopinfo.type == "unknown") {
                return false;
            }
            let refop = cannonicalOp(refops[i], refcalli.buildnr, refopinfo.type);
            if (buf.byteLength < offset + 2) {
                return false;
            }
            let opid = buf.readUint16BE(offset);
            offset += 2;
            let imm = parseImm(buf, offset, refop.immtype);
            if (!imm) {
                return false;
            }
            offset = imm.offset;
            let op = { opcode: refop.opcode, imm: imm.imm, imm_obj: imm.imm_obj };
            if (!isOpEqual(cannonicalOp(op, newbuildnr, refop.immtype), refop)) {
                return false;
            }
            unconfirmed.set(opid, refop);
        }
        if (offset != buf.byteLength) {
            return false;
        }
        cand.didmatch = true;
        for (let [k, v] of unconfirmed) {
            let info = new OpcodeInfo(k, v.opcode, [v.immtype]);
            deob.mappings.set(k, info);
            deob.decodedMappings.set(v.opcode, info);
        }
        return true;
    };
    for (let [index, ref] of refcalli.scripts.entries()) {
        let cand = candidates.get(ref.id);
        if (!cand) {
            continue;
        }
        testCandidate(cand, ref.scriptops);
    }
    deob.opidcounter = refcalli.opidcounter;
    console.log(`copied ${deob.mappings.size} opcodes from reference cache, idcount:${deob.opidcounter}`);
}
function findOpcodeImmidiates(calli) {
    let switchcompleted = false;
    let tribytecompleted = false;
    function* tryMakeOp(script, offset, parent, opsleft) {
        if (opsleft == -1) {
            return;
        }
        if (script.opcodedata.length < offset + 2) {
            return;
        }
        let opid = script.opcodedata.readUint16BE(offset);
        //TODO does this assumption hold that opcode 0 can't exist in scrambled caches? 
        //TODO it doesn't hold, but still results in good parsing??
        if (opid == 0) {
            return;
        }
        offset += 2;
        let previoustheory = parent;
        while (previoustheory) {
            if (previoustheory.opid == opid) {
                break;
            }
            previoustheory = previoustheory.parent;
        }
        let op = calli.mappings.get(opid);
        let options = (previoustheory ? [previoustheory.type] : op ? [...op.possibleTypes] : detectableImmediates);
        for (let type of options) {
            if (type == "switch" && switchcompleted && (!op || op.type == "unknown")) {
                continue;
            }
            if (type == "tribyte" && tribytecompleted && (!op || op.type == "unknown")) {
                continue;
            }
            let imm = parseImm(script.opcodedata, offset, type);
            if (!imm) {
                continue;
            }
            yield new ScriptState(script, opid, imm.offset, type, parent, opsleft);
        }
    }
    class ScriptState {
        script;
        endoffset;
        opsleft;
        opid;
        type;
        children = [];
        parent;
        constructor(script, opid, endoffset, type, parent, opsleft) {
            this.script = script;
            this.opid = opid;
            this.endoffset = endoffset;
            this.type = type;
            this.parent = parent;
            this.opsleft = opsleft;
        }
    }
    //copy array since the rest of the code wants it in id order
    let candidates = [...calli.candidates.values()];
    candidates.sort((a, b) => a.script.instructioncount - b.script.instructioncount || a.script.opcodedata.length - b.script.opcodedata.length);
    let runtheories = (cand, chained) => {
        let statesa = [];
        let statesb = [];
        let solutions = [];
        let totalstates = 0;
        //breath first search by alternating two lists
        for (let prev of chained) {
            statesa.push(...tryMakeOp(cand.script, 0, prev, cand.script.instructioncount - 1));
        }
        let bailed = false;
        while (statesa.length != 0) {
            if (statesa.length > 1000) {
                bailed = true;
                break;
            }
            totalstates += statesa.length;
            let sub = undefined;
            while (sub = statesa.pop()) {
                if (sub.opsleft == 0 && sub.endoffset == sub.script.opcodedata.byteLength) {
                    solutions.push(sub);
                }
                else {
                    statesb.push(...tryMakeOp(cand.script, sub.endoffset, sub, sub.opsleft - 1));
                }
            }
            totalstates += statesb.length;
            while (sub = statesb.pop()) {
                if (sub.opsleft == 0 && sub.endoffset == sub.script.opcodedata.byteLength) {
                    solutions.push(sub);
                }
                else {
                    statesa.push(...tryMakeOp(cand.script, sub.endoffset, sub, sub.opsleft - 1));
                }
            }
        }
        return (bailed ? null : solutions);
    };
    let evaluateSolution = (updateCandidate, solutions, maxsols = 10) => {
        let infocount = 0;
        if (solutions.length <= maxsols) {
            let row = solutions;
            updateCandidate?.unknowns.clear();
            while (row.length != 0) {
                let nextrow = [];
                let opid = row[0].opid;
                let types = new Set();
                let matched = true;
                for (let sol of row) {
                    if (sol.opid == opid) {
                        types.add(sol.type);
                    }
                    else {
                        matched = false;
                    }
                    if (sol.parent) {
                        nextrow.push(sol.parent);
                    }
                    row = nextrow;
                }
                if (matched) {
                    let op = calli.mappings.get(opid);
                    if (!op) {
                        op = calli.declareOp(opid, detectableImmediates);
                    }
                    for (let t of op.possibleTypes) {
                        if (!types.has(t)) {
                            op.possibleTypes.delete(t);
                            infocount++;
                        }
                    }
                    if (op.possibleTypes.size == 1 && op.type == "unknown") {
                        op.type = op.possibleTypes.values().next().value;
                    }
                    if (op.type == "unknown" && updateCandidate) {
                        updateCandidate.unknowns.set(op.id, op);
                    }
                }
            }
        }
        if (updateCandidate) {
            updateCandidate.solutioncount = solutions.length;
        }
        return infocount;
    };
    let runfixedaddition = () => {
        for (let limit of [10, 10, 10, 20, 30, 40, 50, 100, 1e10, 1e10, 1e10, 1e10]) {
            for (let cand of candidates) {
                if (cand.solutioncount == 1) {
                    continue;
                }
                if (cand.script.instructioncount > limit) {
                    break;
                }
                //TODO very wasteful n^2 going on here, take it out of loop?
                let nswitch = 0;
                let ntribyte = 0;
                for (let op of calli.mappings.values()) {
                    if (op.type == "switch") {
                        nswitch++;
                    }
                    if (op.type == "tribyte") {
                        ntribyte++;
                    }
                }
                if (!switchcompleted && nswitch == 1) {
                    switchcompleted = true;
                    console.log("switch completed");
                }
                if (!tribytecompleted && ntribyte == 2) {
                    tribytecompleted = true;
                    console.log("tribyte completed");
                }
                if (nswitch > 1) {
                    throw new Error("");
                }
                if (ntribyte > 2) {
                    throw new Error("");
                }
                let solutions = runtheories(cand, [null]);
                if (solutions) {
                    evaluateSolution(cand, solutions);
                }
            }
            let combinable = candidates
                .filter(q => q.unknowns.size >= 1)
                .sort((a, b) => a.unknowns.size - b.unknowns.size || firstKey(a.unknowns) - firstKey(b.unknowns));
            let run = () => {
                if (index == lastindex + 1) {
                    return;
                }
                let solutions = null;
                for (let i = lastindex; i < index; i++) {
                    let cand = combinable[i];
                    let res = runtheories(cand, solutions ?? [null]);
                    if (!res) {
                        return;
                    }
                    solutions = res;
                }
                if (solutions) {
                    evaluateSolution(null, solutions);
                }
            };
            let lastkey = -1;
            let lastindex = -1;
            let index = 0;
            for (; index < combinable.length; index++) {
                let cand = combinable[index];
                let key = firstKey(cand.unknowns);
                if (key != lastkey) {
                    run();
                    lastkey = key;
                    lastindex = index;
                }
            }
            run();
            console.log(limit, calli.mappings.size);
        }
    };
    runfixedaddition();
    // console.log([...mappings].sort((a, b) => a[0] - b[0]).map(q => [q[0].toString(16), [...q[1].possibleTypes].join(",")]));
    calli.foundEncodings = true;
    //TODO return values are obsolete
    return {
        test(id) {
            let cand = candidates.find(q => q.id == id);
            runtheories(cand, [null]);
        },
        getop(opid) {
            let cands = candidates.filter(q => q.unknowns.has(opid));
            return cands;
        },
        candidates,
        runtheories,
        evaluateSolution,
        testCascade(ipop) {
            let target = [ipop];
            outerloop: while (true) {
                let cands = candidates.filter(q => target.some(w => q.unknowns.has(w)));
                console.log(cands);
                let sols = null;
                for (let cand of cands) {
                    sols = runtheories(cand, sols ?? [null]);
                    if (!sols) {
                        return "too many states";
                    }
                }
                console.log(sols);
                let changecount = evaluateSolution(null, sols, 500);
                if (changecount != 0) {
                    return changecount;
                }
                for (let cand of cands) {
                    for (let unk of cand.unknowns.keys()) {
                        if (!target.includes(unk)) {
                            target.push(unk);
                            continue outerloop;
                        }
                    }
                }
                return "could not expand problem further";
            }
        }
    };
}
function callibrateOperants(calli, candidates) {
    //TODO merge with previous loop?
    let allsections = [];
    for (let cand of candidates.values()) {
        if (!cand.scriptcontents) {
            continue;
        }
        let { sections } = (0, ast_1.generateAst)(calli, cand.script, cand.scriptcontents.opcodedata, cand.id);
        allsections.push(...sections);
    }
    allsections.sort((a, b) => a.children.length - b.children.length);
    globalThis.allsections = allsections; //TODO remove
    let testSection = (eq) => {
        let { section, unknowns } = eq;
        //scan through the ops from front to back
        let frontstack = new definitions_1.StackList();
        //TODO currently unused
        let frontstackconsts = new definitions_1.StackConstants();
        for (let i = 0; i < section.children.length; i++) {
            let node = section.children[i];
            if (!(node instanceof ast_1.RawOpcodeNode) || node.unknownstack) {
                break;
            }
            if (node.knownStackDiff) {
                frontstack.pop(node.knownStackDiff.in);
                frontstack.push(node.knownStackDiff.out);
                frontstackconsts.popList(node.knownStackDiff.in);
                if (node.knownStackDiff.constout != null) {
                    frontstackconsts.pushOne(node.knownStackDiff.constout);
                }
                else {
                    frontstackconsts.pushList(node.knownStackDiff.out);
                }
            }
            else {
                let info = node.opinfo.stackinfo;
                if (!info.initializedin) {
                    info.in = frontstack.clone();
                    info.initializedin = true;
                }
                else {
                    let shortage = frontstack.tryPop(info.in);
                    if (shortage > 0) {
                        if (info.initializedthrough) {
                            if (info.out.tryPopReverse(info.in, info.in.values.length - shortage) != 0) {
                                throw new Error("not compatible");
                            }
                        }
                        info.in.values.splice(0, shortage);
                    }
                    frontstackconsts.popList(info.in);
                }
                if (!info.initializedthrough || !info.initializedout) {
                    break;
                }
                frontstack.push(info.out);
                frontstackconsts.pushList(info.out);
            }
        }
        //scan through the ops from back to front
        let backstack = new definitions_1.StackList();
        for (let i = 0; i < section.children.length; i++) {
            let node = section.children[section.children.length - 1 - i];
            if (!(node instanceof ast_1.RawOpcodeNode) || node.unknownstack) {
                break;
            }
            if (node.knownStackDiff) {
                backstack.pop(node.knownStackDiff.out);
                backstack.push(node.knownStackDiff.in);
            }
            else {
                let info = node.opinfo.stackinfo;
                if (!info.initializedout) {
                    info.out = backstack.clone();
                    info.initializedout = true;
                }
                else {
                    let shortage = backstack.tryPop(info.out);
                    if (shortage > 0) {
                        if (info.initializedthrough) {
                            if (info.in.tryPopReverse(info.out, info.out.values.length - shortage) != 0) {
                                throw new Error("not compatible");
                            }
                        }
                        info.out.values.splice(0, shortage);
                    }
                }
                if (!info.initializedthrough || !info.initializedin) {
                    break;
                }
                backstack.push(info.in);
            }
        }
        let unkcount = 0;
        let unktype = null;
        let totalstack = 0;
        let hasproblemops = false;
        unknowns.clear();
        for (let child of section.children) {
            if (!(child instanceof ast_1.RawOpcodeNode) || child.unknownstack) {
                hasproblemops = true;
                break;
            }
            if (child.knownStackDiff) {
                totalstack += child.knownStackDiff.totalChange();
            }
            else if (child.opinfo.stackinfo.initializedthrough) {
                totalstack += child.opinfo.stackinfo.totalChange();
            }
            else {
                unktype = child.opinfo;
                unknowns.add(child.opinfo);
                unkcount++;
            }
        }
        if (!hasproblemops && !unktype && totalstack != 0) {
            throw new Error("total stack doesn't add up to 0");
        }
        if (!hasproblemops && unktype && unknowns.size == 1) {
            if ((0, utils_1.posmod)(totalstack, unkcount) != 0) {
                throw new Error("stack different is not evenly dividable between equal ops");
            }
            let diffeach = totalstack / unkcount + unktype.stackinfo.totalChange();
            //might fail if order at front of stack is unknown
            let success = true;
            if (diffeach > 0) {
                success = unktype.stackinfo.out.tryShift(diffeach);
            }
            else if (diffeach < 0) {
                success = unktype.stackinfo.in.tryShift(-diffeach);
            }
            if (success) {
                unktype.stackinfo.initializedthrough = true;
                unknowns.delete(unktype);
                foundset.add(unktype.id);
            }
        }
        for (let unk of unknowns) {
            let prev = opmap.get(unk.id);
            if (!prev) {
                prev = new Set();
                prev.add(eq);
                opmap.set(unk.id, prev);
            }
            prev.add(eq);
        }
    };
    let opmap = new Map();
    let pendingEquations = [];
    let foundset = new Set();
    for (let section of allsections) {
        let eq = { section, unknowns: new Set() };
        for (let op of section.children) {
            if (op instanceof ast_1.RawOpcodeNode) {
                op.opinfo.stackChangeConstraints.add(eq);
            }
        }
        testSection(eq);
        pendingEquations.push(eq);
    }
    for (let i = 0; i < 3; i++) {
        for (let eq of pendingEquations) {
            testSection(eq);
        }
        let total = 0;
        let partial = 0;
        let done = 0;
        let missing = new Set();
        for (let op of calli.mappings.values()) {
            if (op.stackinfo.initializedthrough) {
                done++;
            }
            else if (op.stackinfo.initializedin || op.stackinfo.initializedout) {
                partial++;
            }
            else {
                missing.add(op);
            }
            total++;
        }
        console.log("total", total, "done", done, "partial", partial, "incomplete", missing.size);
    }
    calli.foundParameters = true;
}
function getArgType(script) {
    let res = new definitions_1.StackDiff();
    res.int = script.intargcount;
    res.long = script.longargcount;
    res.string = script.stringargcount;
    return res;
}
function getReturnType(calli, ops, endindex = ops.length) {
    let res = new definitions_1.StackList();
    //the jagex compiler appends a default return with null constants to the script, even if this would be dead code
    //endindex-1=return, pushconsts begins at -2
    for (let i = endindex - 2; i >= 0; i--) {
        let op = ops[i];
        let opinfo = calli.getNamedOp(op.opcode);
        if (opinfo.id == definitions_1.namedClientScriptOps.pushconst) {
            if (op.imm == 0) {
                res.int();
            }
            if (op.imm == 1) {
                res.long();
            }
            if (op.imm == 2) {
                res.string();
            }
        }
        else if (opinfo.id == definitions_1.namedClientScriptOps.pushint) {
            res.int();
        }
        else if (opinfo.id == definitions_1.namedClientScriptOps.pushlong) {
            res.long();
        }
        else if (opinfo.id == definitions_1.namedClientScriptOps.pushstring) {
            res.string();
        }
        else {
            break;
        }
    }
    res.values.reverse();
    return res;
}
//TODO remove/hide
globalThis.getop = (opid) => {
    let id = -1;
    //don't use match because it breaks console hints
    if (opid.startsWith("unk")) {
        id = +opid.slice(3);
    }
    else {
        for (let op in definitions_1.knownClientScriptOpNames) {
            if (definitions_1.knownClientScriptOpNames[op] == opid) {
                id = +op;
            }
        }
    }
    let calli = globalThis.deob;
    return calli.decodedMappings.get(id);
};
function firstKey(map) {
    return map.keys().next().value;
}
