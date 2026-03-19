"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientScriptSubtypeSolver = void 0;
exports.detectSubtypes = detectSubtypes;
exports.assignKnownTypes = assignKnownTypes;
const ast_1 = require("./ast");
const definitions_1 = require("./definitions");
//to test
//await cli("extract --mode clientscript -i 0");await deob.preloadData(false);deob.parseCandidateContents();detectSubTypes(deob);
const looseOps = [
    //TODO most of these have known types depending on literal args
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.enum_hasoutput) | (0, definitions_1.dependencyIndex)("int", 2),
    (0, definitions_1.dependencyGroup)("opout", definitions_1.namedClientScriptOps.enum_getreverseindex) | (0, definitions_1.dependencyIndex)("int", 0),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.enum_getreverseindex) | (0, definitions_1.dependencyIndex)("int", 3),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.enum_getreversecount) | (0, definitions_1.dependencyIndex)("int", 2),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.enum_getstring) | (0, definitions_1.dependencyIndex)("int", 1),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.popdiscardint) | (0, definitions_1.dependencyIndex)("int", 0),
    (0, definitions_1.dependencyGroup)("opout", definitions_1.namedClientScriptOps.lc_getparam) | (0, definitions_1.dependencyIndex)("int", 0),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.cc_setparam) | (0, definitions_1.dependencyIndex)("int", 1),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.db_find_with_count) | (0, definitions_1.dependencyIndex)("int", 1),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.pop_array) | (0, definitions_1.dependencyIndex)("int", 1),
    (0, definitions_1.dependencyGroup)("opout", definitions_1.namedClientScriptOps.push_array) | (0, definitions_1.dependencyIndex)("int", 0),
    (0, definitions_1.dependencyGroup)("opin", definitions_1.namedClientScriptOps.switch) | (0, definitions_1.dependencyIndex)("int", 0),
    (0, definitions_1.knownDependency)(definitions_1.subtypes.unknown_int),
    (0, definitions_1.knownDependency)(definitions_1.subtypes.unknown_long),
    (0, definitions_1.knownDependency)(definitions_1.subtypes.unknown_string),
    ...definitions_1.branchInstructionsInt.flatMap(q => [(0, definitions_1.dependencyGroup)("opin", q) | (0, definitions_1.dependencyIndex)("int", 0), (0, definitions_1.dependencyGroup)("opin", q) | (0, definitions_1.dependencyIndex)("int", 1)]),
    ...definitions_1.branchInstructionsLong.flatMap(q => [(0, definitions_1.dependencyGroup)("opin", q) | (0, definitions_1.dependencyIndex)("long", 0), (0, definitions_1.dependencyGroup)("opin", q) | (0, definitions_1.dependencyIndex)("long", 1)]),
];
class ClientScriptSubtypeSolver {
    map = new Map();
    knowntypes = new Map();
    uuidcounter = 1;
    constructor() {
        for (let subtype of Object.values(definitions_1.subtypes)) {
            let key = (0, definitions_1.knownDependency)(subtype);
            this.knowntypes.set(key, subtype);
        }
    }
    entangle(key, other) {
        if (other == undefined) {
            return;
        }
        if (key == other) {
            return;
        }
        if (looseOps.includes(key) || looseOps.includes(other)) {
            return;
        }
        if (Array.isArray(globalThis.testkey) && key == globalThis.testkey[0] && other == globalThis.testkey[1]) {
            debugger;
        }
        if (Array.isArray(globalThis.testkey) && key == globalThis.testkey[1] && other == globalThis.testkey[0]) {
            debugger;
        }
        if (typeof globalThis.testboth == "number" && (key == globalThis.testboth || other == globalThis.testboth)) {
            debugger;
        }
        if (key < 512 && other < 512) {
            // debugger;
            console.log(`unexpected exact type equation ${key} ${other}`);
        }
        let eqset = this.map.get(key);
        if (!eqset) {
            eqset = new Set();
            this.map.set(key, eqset);
        }
        eqset.add(other);
        let otherset = this.map.get(other);
        if (!otherset) {
            otherset = new Set();
            this.map.set(other, otherset);
        }
        otherset.add(key);
    }
    parseSections(sections) {
        for (let section of sections) {
            //TODO the solver currently doesn't support subfunc scope
            if (section.subfuncid != -1) {
                continue;
            }
            let stack = new CombinedExactStack(this);
            for (let op of section.children) {
                if (op instanceof ast_1.RawOpcodeNode) {
                    if (!stack.pushopcode(op, section.scriptid)) {
                        break;
                    }
                }
                else if (op instanceof ast_1.ClientScriptFunction) {
                    break;
                }
                else if (op instanceof ast_1.SubcallNode) {
                    break;
                }
                else {
                    throw new Error("unexpected");
                }
            }
        }
    }
    addKnownFromCalli(calli) {
        for (let key of this.map.keys()) {
            let [type, stacktype, group, index] = (0, definitions_1.decomposeKey)(key);
            let isin = type == "opin" || type == "scriptargvar";
            let isscript = type == "scriptargvar" || type == "scriptret";
            let isop = type == "opin" || type == "opout";
            if (isscript || isop) {
                let stackinout = (isscript ? calli.scriptargs.get(group)?.stack : calli.decodedMappings.get(group)?.stackinfo);
                if (stackinout) {
                    let stack = (isin ? stackinout.exactin : stackinout.exactout);
                    if (stack) {
                        let typedstack = stack[stacktype];
                        if (index < typedstack.length) {
                            this.knowntypes.set(key, typedstack[index]);
                        }
                    }
                }
            }
        }
    }
    solve() {
        let activekeys = new Set(this.knowntypes.keys());
        let itercount = 0;
        while (activekeys.size != 0) {
            // console.log(`iteration ${itercount++}, known: ${this.knowntypes.size}, active:${activekeys.size}`);
            let nextactivekeys = new Set();
            for (let key of activekeys) {
                let links = this.map.get(key);
                if (links) {
                    let known = this.knowntypes.get(key);
                    for (let link of links) {
                        let prevknown = this.knowntypes.get(link);
                        if (typeof prevknown == "undefined") {
                            nextactivekeys.add(link);
                            this.knowntypes.set(link, known);
                        }
                        else if (prevknown != known) {
                            globalThis.testkey = [key, link];
                            throw new Error(`conflicting types old:${Object.entries(definitions_1.subtypes).find(q => q[1] == prevknown)?.[0] ?? "??"}, new:${Object.entries(definitions_1.subtypes).find(q => q[1] == known)?.[0] ?? "??"}\n${key} - ${(0, definitions_1.debugKey)(key)}\n${link} - ${(0, definitions_1.debugKey)(link)}`);
                        }
                    }
                }
            }
            activekeys = nextactivekeys;
        }
    }
}
exports.ClientScriptSubtypeSolver = ClientScriptSubtypeSolver;
function getScriptLocalDep(env, type, index) {
    return env;
}
function getPositionalDep(env, type, index) {
    return env | (0, definitions_1.dependencyIndex)(type, index);
}
class CombinedExactStack {
    intstack = [];
    longstack = [];
    stringstack = [];
    consts = new definitions_1.StackConstants();
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    pushopcode(node, scriptid) {
        if (Array.isArray(globalThis.test) && globalThis.test[0] == scriptid && globalThis.test[1] == node.originalindex) {
            debugger;
        }
        let stackinout = node.knownStackDiff ?? node.opinfo.stackinfo;
        if (!stackinout.initializedthrough) {
            return false;
        }
        if (!node.knownStackDiff && definitions_1.dynamicOps.includes(node.op.opcode)) {
            return false;
        }
        let depenvin = 0;
        let depenvout = 0;
        let depfunc;
        let islocalint = node.opinfo.id == definitions_1.namedClientScriptOps.poplocalint || node.opinfo.id == definitions_1.namedClientScriptOps.pushlocalint;
        let islocallong = node.opinfo.id == definitions_1.namedClientScriptOps.poplocallong || node.opinfo.id == definitions_1.namedClientScriptOps.pushlocallong;
        let islocalstring = node.opinfo.id == definitions_1.namedClientScriptOps.poplocalstring || node.opinfo.id == definitions_1.namedClientScriptOps.pushlocalstring;
        if (islocalint || islocallong || islocalstring) {
            const typestr = (islocalint ? "int" : islocallong ? "long" : "string");
            depenvin = (0, definitions_1.dependencyGroup)("scriptargvar", scriptid) | (0, definitions_1.dependencyIndex)(typestr, node.op.imm);
            depenvout = depenvin;
            depfunc = getScriptLocalDep;
        }
        else if (node.opinfo.id == definitions_1.namedClientScriptOps.gosub) {
            depenvin = (0, definitions_1.dependencyGroup)("scriptargvar", node.op.imm);
            depenvout = (0, definitions_1.dependencyGroup)("scriptret", node.op.imm);
            depfunc = getPositionalDep;
        }
        else if (node.opinfo.id == definitions_1.namedClientScriptOps.return) {
            depenvin = (0, definitions_1.dependencyGroup)("scriptret", scriptid);
            depenvout = depenvin; //doesn't happen
            depfunc = getPositionalDep;
        }
        else {
            depenvin = (0, definitions_1.dependencyGroup)("opin", node.op.opcode);
            depenvout = (0, definitions_1.dependencyGroup)("opout", node.op.opcode);
            depfunc = getPositionalDep;
        }
        if (node.knownStackDiff?.exactin) {
            let exact = node.knownStackDiff.exactin;
            for (let i = exact.int.length - 1; i >= 0; i--) {
                this.ctx.entangle((0, definitions_1.knownDependency)(exact.int[i]), this.intstack.pop());
            }
            for (let i = exact.long.length - 1; i >= 0; i--) {
                this.ctx.entangle((0, definitions_1.knownDependency)(exact.long[i]), this.longstack.pop());
            }
            for (let i = exact.string.length - 1; i >= 0; i--) {
                this.ctx.entangle((0, definitions_1.knownDependency)(exact.string[i]), this.stringstack.pop());
            }
        }
        else {
            let stackin = stackinout.in;
            //need to do inputs in correct order because of vararg
            let stackcounts = stackin.getStackdiff();
            for (let i = stackin.values.length - 1; i >= 0; i--) {
                let value = stackin.values[i];
                if (value instanceof definitions_1.StackDiff) {
                    for (let i = value.int - 1; i >= 0; i--) {
                        this.ctx.entangle(depfunc(depenvin, "int", --stackcounts.int), this.intstack.pop());
                    }
                    for (let i = value.long - 1; i >= 0; i--) {
                        this.ctx.entangle(depfunc(depenvin, "long", --stackcounts.long), this.longstack.pop());
                    }
                    for (let i = value.string - 1; i >= 0; i--) {
                        this.ctx.entangle(depfunc(depenvin, "string", --stackcounts.string), this.stringstack.pop());
                    }
                }
                else if (value == "int") {
                    this.ctx.entangle(depfunc(depenvin, "int", --stackcounts.int), this.intstack.pop());
                }
                else if (value == "long") {
                    this.ctx.entangle(depfunc(depenvin, "long", --stackcounts.long), this.longstack.pop());
                }
                else if (value == "string") {
                    this.ctx.entangle(depfunc(depenvin, "string", --stackcounts.string), this.stringstack.pop());
                }
                else if (value == "vararg") {
                    return false; //TODO implement
                    //todo there might actually be a "vararg" on stack at this point because of generateAst
                    // let varargs = varArgtype(this.consts.pop(), this.consts.values.at(-1));
                    // if (!varargs) { throw new Error("vararg string expected on constant stack"); }
                    // this.consts.popList(varargs);
                }
                else {
                    throw new Error("unexpected");
                }
            }
        }
        if (node.knownStackDiff?.exactout) {
            let exact = node.knownStackDiff.exactout;
            for (let i = 0; i < exact.int.length; i++) {
                this.intstack.push((0, definitions_1.knownDependency)(exact.int[i]));
            }
            for (let i = 0; i < exact.long.length; i++) {
                this.longstack.push((0, definitions_1.knownDependency)(exact.long[i]));
            }
            for (let i = 0; i < exact.string.length; i++) {
                this.stringstack.push((0, definitions_1.knownDependency)(exact.string[i]));
            }
        }
        else {
            //only ensure order per primitive type
            let totalout = stackinout.out.getStackdiff();
            if (totalout.vararg != 0) {
                return false;
            } //TODO implement
            if (!totalout.isNonNegative() || totalout.vararg != 0) {
                throw new Error("unexpected");
            }
            for (let i = 0; i < totalout.int; i++) {
                this.intstack.push(depfunc(depenvout, "int", i));
            }
            for (let i = 0; i < totalout.long; i++) {
                this.longstack.push(depfunc(depenvout, "long", i));
            }
            for (let i = 0; i < totalout.string; i++) {
                this.stringstack.push(depfunc(depenvout, "string", i));
            }
        }
        return true;
    }
}
function detectSubtypes(calli, candidates) {
    let ctx = new ClientScriptSubtypeSolver();
    for (let cand of candidates.values()) {
        if (!cand.scriptcontents) {
            continue;
        }
        let { sections } = (0, ast_1.generateAst)(calli, cand.script, cand.scriptcontents.opcodedata, cand.id);
        ctx.parseSections(sections);
    }
    ctx.solve();
    assignKnownTypes(calli, ctx.knowntypes);
    calli.foundSubtypes = true;
}
function assignKnownTypes(calli, knowntypes) {
    for (let op of calli.mappings.values()) {
        if (!op.stackinfo.initializedthrough) {
            continue;
        }
        let exactin = new definitions_1.ExactStack();
        let diffin = op.stackinfo.in.getStackdiff();
        for (let i = 0; i < diffin.int; i++) {
            exactin.int.push(knowntypes.get((0, definitions_1.dependencyGroup)("opin", op.id) | (0, definitions_1.dependencyIndex)("int", i)) ?? definitions_1.subtypes.unknown_int);
        }
        for (let i = 0; i < diffin.long; i++) {
            exactin.long.push(knowntypes.get((0, definitions_1.dependencyGroup)("opin", op.id) | (0, definitions_1.dependencyIndex)("long", i)) ?? definitions_1.subtypes.unknown_long);
        }
        for (let i = 0; i < diffin.string; i++) {
            exactin.string.push(knowntypes.get((0, definitions_1.dependencyGroup)("opin", op.id) | (0, definitions_1.dependencyIndex)("string", i)) ?? definitions_1.subtypes.unknown_string);
        }
        op.stackinfo.exactin = exactin;
        let exactout = new definitions_1.ExactStack();
        let diffout = op.stackinfo.out.getStackdiff();
        for (let i = 0; i < diffout.int; i++) {
            exactout.int.push(knowntypes.get((0, definitions_1.dependencyGroup)("opout", op.id) | (0, definitions_1.dependencyIndex)("int", i)) ?? definitions_1.subtypes.unknown_int);
        }
        for (let i = 0; i < diffout.long; i++) {
            exactout.long.push(knowntypes.get((0, definitions_1.dependencyGroup)("opout", op.id) | (0, definitions_1.dependencyIndex)("long", i)) ?? definitions_1.subtypes.unknown_long);
        }
        for (let i = 0; i < diffout.string; i++) {
            exactout.string.push(knowntypes.get((0, definitions_1.dependencyGroup)("opout", op.id) | (0, definitions_1.dependencyIndex)("string", i)) ?? definitions_1.subtypes.unknown_string);
        }
        op.stackinfo.exactout = exactout;
    }
    for (let [id, func] of calli.scriptargs) {
        let exactin = new definitions_1.ExactStack();
        let diffin = func.stack.in.getStackdiff();
        for (let i = 0; i < diffin.int; i++) {
            exactin.int.push(knowntypes.get((0, definitions_1.dependencyGroup)("scriptargvar", id) | (0, definitions_1.dependencyIndex)("int", i)) ?? definitions_1.subtypes.unknown_int);
        }
        for (let i = 0; i < diffin.long; i++) {
            exactin.long.push(knowntypes.get((0, definitions_1.dependencyGroup)("scriptargvar", id) | (0, definitions_1.dependencyIndex)("long", i)) ?? definitions_1.subtypes.unknown_long);
        }
        for (let i = 0; i < diffin.string; i++) {
            exactin.string.push(knowntypes.get((0, definitions_1.dependencyGroup)("scriptargvar", id) | (0, definitions_1.dependencyIndex)("string", i)) ?? definitions_1.subtypes.unknown_string);
        }
        func.stack.exactin = exactin;
        let exactout = new definitions_1.ExactStack();
        let diffout = func.stack.out.getStackdiff();
        for (let i = 0; i < diffout.int; i++) {
            exactout.int.push(knowntypes.get((0, definitions_1.dependencyGroup)("scriptret", id) | (0, definitions_1.dependencyIndex)("int", i)) ?? definitions_1.subtypes.unknown_int);
        }
        for (let i = 0; i < diffout.long; i++) {
            exactout.long.push(knowntypes.get((0, definitions_1.dependencyGroup)("scriptret", id) | (0, definitions_1.dependencyIndex)("long", i)) ?? definitions_1.subtypes.unknown_long);
        }
        for (let i = 0; i < diffout.string; i++) {
            exactout.string.push(knowntypes.get((0, definitions_1.dependencyGroup)("scriptret", id) | (0, definitions_1.dependencyIndex)("string", i)) ?? definitions_1.subtypes.unknown_string);
        }
        func.stack.exactout = exactout;
    }
    return knowntypes;
}
