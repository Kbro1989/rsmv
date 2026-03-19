"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeOpcodeFile = exports.writeClientVarFile = void 0;
exports.compileClientScript = compileClientScript;
exports.renderClientScript = renderClientScript;
exports.prepareClientScript = prepareClientScript;
exports.clientscriptHash = clientscriptHash;
const codewriter_1 = require("./codewriter");
const ast_1 = require("./ast");
const callibrator_1 = require("./callibrator");
const codeparser_1 = require("../clientscript/codeparser");
const opdecoder_1 = require("../opdecoder");
const jsonwriter_1 = require("./jsonwriter");
const crc32util_1 = require("../libs/crc32util");
// import { Openrs2CacheSource } from "../cache/openrs2loader";
// import { GameCacheLoader } from "../cache/sqlite";
var codeparser_2 = require("../clientscript/codeparser");
Object.defineProperty(exports, "writeClientVarFile", { enumerable: true, get: function () { return codeparser_2.writeClientVarFile; } });
Object.defineProperty(exports, "writeOpcodeFile", { enumerable: true, get: function () { return codeparser_2.writeOpcodeFile; } });
async function compileClientScript(source, code) {
    let calli = await prepareClientScript(source);
    let parseresult = (0, codeparser_1.parseClientscriptTs)(calli, code);
    if (!parseresult.success) {
        throw new Error("failed to parse clientscript", { cause: parseresult.failedOn });
    }
    if (parseresult.remaining != "") {
        throw new Error("failed to parse clientscript, left over: " + parseresult.remaining.slice(0, 100));
    }
    return (0, jsonwriter_1.astToImJson)(calli, parseresult.result);
}
async function renderClientScript(source, buf, fileid, relativeComps = false, notypes = false, int32casts = false) {
    let calli = await prepareClientScript(source);
    let script = opdecoder_1.parse.clientscript.read(buf, source);
    let { rootfunc, sections, typectx } = (0, ast_1.parseClientScriptIm)(calli, script, fileid);
    // globalThis[`cs${fileid}`] = rootfunc;//TODO remove
    let writer = new codewriter_1.TsWriterContext(calli, typectx);
    if (relativeComps) {
        writer.setCompOffsets(rootfunc);
    }
    writer.typescript = !notypes;
    writer.int32casts = int32casts;
    let res = writer.getCode(rootfunc);
    return res;
}
async function prepareClientScript(source) {
    if (!source.decodeArgs.clientScriptDeob) {
        let deobsource = source;
        // use equivelant openrs2 cache instead to prevent problems with edits begin invalid
        // if (source instanceof GameCacheLoader) {
        //     deobsource = new Openrs2CacheSource(await Openrs2CacheSource.getRecentCache());
        // }
        let deob = await callibrator_1.ClientscriptObfuscation.create(deobsource);
        source.decodeArgs.clientScriptDeob = deob;
        await deob.runAutoCallibrate(source);
        await deob.save();
        globalThis.deob = deob; //TODO remove
    }
    return source.decodeArgs.clientScriptDeob;
}
// const runtimesecret = 0x120B00B0;
// const runtimename = `_runtime${runtimesecret.toString(16)}`;
// const runtimeFuncs: Record<string, ClientScriptFunction> = {
//     [`${runtimename}_call`]: (() => {
//         let func = new ClientScriptFunction(`${runtimename}_call`, new StackList(), new StackList(), new StackDiff(1, 0, 0));
//         let intr = intrinsics.get("call");
//         if (!intr) { throw new Error("unexpected"); }
//         let code = new CodeBlockNode(-1, -1);
//         let node = new SubcallNode(-1, "call", intr.in, intr.out);
//         code.push(node);
//         func.children.push(code);
//         return func;
//     })()
// }
function clientscriptHash(script) {
    let hash = 0;
    hash = (0, crc32util_1.crc32addInt)(script.byte0, hash);
    hash = (0, crc32util_1.crc32addInt)(script.intargcount, hash);
    hash = (0, crc32util_1.crc32addInt)(script.longargcount, hash);
    hash = (0, crc32util_1.crc32addInt)(script.stringargcount, hash);
    hash = (0, crc32util_1.crc32addInt)(script.localintcount, hash);
    hash = (0, crc32util_1.crc32addInt)(script.locallongcount, hash);
    hash = (0, crc32util_1.crc32addInt)(script.localstringcount, hash);
    hash = (0, crc32util_1.crc32addInt)(script.instructioncount, hash);
    for (let op of script.opcodedata) {
        hash = (0, crc32util_1.crc32addInt)(op.opcode, hash);
        hash = (0, crc32util_1.crc32addInt)(op.imm, hash);
        if (op.imm_obj == null) { }
        else if (typeof op.imm_obj == "number") {
            hash = (0, crc32util_1.crc32addInt)(op.imm_obj, hash);
        }
        else if (Array.isArray(op.imm_obj)) {
            hash = (0, crc32util_1.crc32addInt)(op.imm_obj[0], hash);
            hash = (0, crc32util_1.crc32addInt)(op.imm_obj[1], hash);
        }
        else if (typeof op.imm_obj == "string") {
            hash = (0, crc32util_1.crc32)(Buffer.from(op.imm_obj, "latin1"), hash);
        }
        else {
            throw new Error("unexpected");
        }
    }
    hash = (0, crc32util_1.crc32addInt)(script.switchsize, hash);
    for (let sub of script.switches) {
        hash = (0, crc32util_1.crc32addInt)(sub.length, hash);
        for (let choice of sub) {
            hash = (0, crc32util_1.crc32addInt)(choice.value, hash);
            hash = (0, crc32util_1.crc32addInt)(choice.jump, hash);
        }
    }
    return hash;
}
// export async function writeExtendedRuntimeScripts(source: CacheFileSource) {
//     let calli = await prepareClientScript(source);
//     let missingruntimes = new Map<string, { scriptid: number, ast: ReturnType<typeof generateAst> } | null>(Object.keys(runtimeFuncs).map(q => [q, null]));
//     let targetin = new StackDiff(1, 0, 0);
//     let candidates: { scriptid: number, script: clientscript, ast: ReturnType<typeof generateAst> }[] = [];
//     for (let [id, cand] of calli.scriptargs) {
//         if (cand.stack.in.toStackDiff().equals(targetin) && cand.stack.out.isEmpty()) {
//             let script = parse.clientscript.read(await source.getFileById(cacheMajors.clientscript, id), source);
//             let ast = generateAst(calli, script, script.opcodedata, id);
//             let matchcount = 0;
//             for (let sub of ast.subfuncs) {
//                 let runtimeid = missingruntimes.get(sub.scriptname);
//                 if (runtimeid === null) {
//                     missingruntimes.set(sub.scriptname, { scriptid: id, ast });
//                     matchcount++
//                 }
//             }
//             if (matchcount > 1) { throw new Error("multiple runtime funcs in one script, unexpected"); }
//             if (matchcount == 0) {
//                 if (ast.sections.length == 1 && ast.sections[0].children.length<20) {
//                     candidates.push({ scriptid: id, script, ast });
//                     if (candidates.length > missingruntimes.size + 10) { break; }
//                 }
//             }
//         }
//     }
//     for (let [name, meta] of missingruntimes) {
//         if (meta) { continue; }
//         let cand = candidates.shift();
//         if (!cand) { throw new Error("not enough runtime candidate scripts, unexpected"); }
//         let ops =
//     }
// }
