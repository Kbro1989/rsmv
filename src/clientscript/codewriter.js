"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TsWriterContext = void 0;
exports.debugAst = debugAst;
const ast_1 = require("./ast");
const subtypedetector_1 = require("./subtypedetector");
const definitions_1 = require("./definitions");
const utils_1 = require("../utils");
/**
 * known compiler differences
 * - in some situations bunny hop jumps in nested ifs are merged while the jagex compiler doesn't
 * - default return values for int can be -1 for some specialisations while this compiler doesn't know about those
 * - this ast tree automatically strips dead code so round trips won't be identical if there dead code
 * - when a script has no return values but the original code had an explicit return then this compiler won't output that
 * - the jagex compiler uses some unknown logic to put the default branch of a switch statement either at the start or end of the block
 */
/**
 * decompiler TODO
 * - fix default return of -1 for int specialisations
 * - fix function bind arrays
 */
function debugAst(node) {
    let writer = new TsWriterContext(globalThis.deob, new subtypedetector_1.ClientScriptSubtypeSolver());
    let res = "";
    if (node instanceof ast_1.CodeBlockNode) {
        res += `//[${node.scriptid},${node.originalindex}]\n`;
    }
    res += writer.getCode(node);
    console.log(res);
}
globalThis.debugAst = debugAst;
class TsWriterContext {
    calli;
    typectx;
    indents = [];
    declaredVars = [];
    compoffsets = new Map();
    usecompoffset = false;
    int32casts = false;
    typescript = true;
    constructor(calli, typectx) {
        this.calli = calli;
        this.typectx = typectx;
    }
    setCompOffsets(rootnode) {
        let cursor = new ast_1.RewriteCursor(rootnode);
        for (let node = cursor.goToStart(); node; node = cursor.next()) {
            if (!(0, ast_1.isNamedOp)(node, definitions_1.namedClientScriptOps.pushconst)) {
                continue;
            }
            if (!node.knownStackDiff?.exactout) {
                continue;
            }
            let all = node.knownStackDiff.exactout.all();
            if (all.length != 1) {
                throw new Error("unexpected");
            }
            let type = this.typectx.knowntypes.get(all[0]);
            if (typeof type != "number") {
                continue;
            }
            if (typeof node.op.imm_obj != "number") {
                continue;
            }
            let intf = node.op.imm_obj >> 16;
            let sub = node.op.imm_obj & 0xffff;
            let least = (0, utils_1.getOrInsert)(this.compoffsets, intf, () => sub);
            if (sub < least) {
                this.compoffsets.set(intf, sub);
            }
        }
        this.usecompoffset = true;
    }
    codeIndent(linenr = -1, hasquestionmark = false) {
        // return (linenr == -1 ? "" : linenr + ":").padEnd(5 + amount * 4, " ") + (hasquestionmark ? "?? " : "   ");
        return "    ".repeat(this.indents.length);
    }
    pushIndent(hasScope) {
        this.indents.push(hasScope);
        if (hasScope) {
            this.declaredVars.push(new Set());
        }
    }
    popIndent() {
        let hadscope = this.indents.pop();
        if (hadscope == undefined) {
            throw new Error("negative indent");
        }
        if (hadscope) {
            this.declaredVars.pop();
        }
    }
    declareLocal(varname) {
        let set = this.declaredVars.at(-1);
        if (!set) {
            throw new Error("no scope");
        }
        if (set.has(varname)) {
            return true;
        }
        else {
            set.add(varname);
            return false;
        }
    }
    getCode = (node) => {
        let writer = writermap.get(node.constructor);
        if (!writer) {
            throw new Error(`no writer defined for ${node.constructor.name} node`);
        }
        return writer(node, this);
    };
}
exports.TsWriterContext = TsWriterContext;
function getOpcodeName(calli, op) {
    if (op.opcode == definitions_1.namedClientScriptOps.poplocalint || op.opcode == definitions_1.namedClientScriptOps.pushlocalint) {
        return `int${op.imm}`;
    }
    else if (op.opcode == definitions_1.namedClientScriptOps.poplocalstring || op.opcode == definitions_1.namedClientScriptOps.pushlocalstring) {
        return `string${op.imm}`;
    }
    else if (op.opcode == definitions_1.namedClientScriptOps.poplocallong || op.opcode == definitions_1.namedClientScriptOps.pushlocallong) {
        return `long${op.imm}`;
    }
    else if (op.opcode == definitions_1.namedClientScriptOps.popdiscardint || op.opcode == definitions_1.namedClientScriptOps.popdiscardlong || op.opcode == definitions_1.namedClientScriptOps.popdiscardstring) {
        return "";
    }
    else if (op.opcode == definitions_1.namedClientScriptOps.popvar || op.opcode == definitions_1.namedClientScriptOps.pushvar) {
        let varmeta = calli.getClientVarMeta(op.imm);
        if (varmeta) {
            return `var${varmeta.name}_${varmeta.varid}`;
        }
        else {
            return `varunk_${op.imm}`;
        }
    }
    else if (op.opcode == definitions_1.namedClientScriptOps.popvarbit || op.opcode == definitions_1.namedClientScriptOps.pushvarbit) {
        let id = op.imm >> 8;
        let optarget = (op.imm & 0xff);
        let varbitmeta = calli.varbitmeta.get(id);
        if (typeof varbitmeta?.varid != "number") {
            return `varbitunk_${op.imm}`;
        }
        else {
            let groupmeta = calli.varmeta.get(varbitmeta.varid >> 16);
            return `varbit${groupmeta?.name ?? "unk"}_${id}${optarget == 0 ? "" : `[${optarget}]`}`; //TODO this is currently not supported in the parser
        }
    }
    return (0, definitions_1.getOpName)(op.opcode);
}
function valueList(ctx, nodes) {
    if (nodes.length == 1) {
        return ctx.getCode(nodes[0]);
    }
    return `[${nodes.map(ctx.getCode).join(", ")}]`;
}
function escapeStringLiteral(source, quotetype) {
    return source.replace(/[`"'\\\n\r\t\b\f\x00-\x1F]|\$\{/g, m => {
        switch (m) {
            case '"': return (quotetype == "double" ? '\\"' : "\"");
            case "'": return (quotetype == "single" ? "\\'" : "'");
            case "\\": return "\\\\";
            case "\n": return "\\n";
            case "\r": return "\\r";
            case "\t": return "\\t";
            case "\b": return "\\b";
            case "\f": return "\\f";
            case "${": return (quotetype == "template" ? "\\${" : "${");
            case "`": return (quotetype == "template" ? "\\`" : "`");
            default: return `\\x${m.charCodeAt(0).toString(16).padStart(2, "0")}`;
        }
    });
}
function writeCall(ctx, funcstring, children) {
    return `${funcstring}(${children.map(ctx.getCode).join(", ")})`;
}
function getOpcodeCallCode(ctx, op, children, originalindex) {
    let binarysymbol = definitions_1.binaryOpSymbols.get(op.opcode);
    if (binarysymbol) {
        if (children.length == 2) {
            if (ctx.int32casts && definitions_1.int32MathOps.has(op.opcode)) {
                // js in32 cast
                return `(${ctx.getCode(children[0])} ${binarysymbol} ${ctx.getCode(children[1])} | 0)`;
            }
            else {
                return `(${ctx.getCode(children[0])} ${binarysymbol} ${ctx.getCode(children[1])})`;
            }
        }
        else {
            return `operator("${binarysymbol}", ${children.map(ctx.getCode).join(", ")})`;
        }
    }
    if (op.opcode == definitions_1.namedClientScriptOps.return) {
        if (children.length == 0) {
            return `return`;
        }
        return `return ${valueList(ctx, children)}`;
    }
    if (op.opcode == definitions_1.namedClientScriptOps.gosub) {
        return writeCall(ctx, `script${op.imm}`, children);
    }
    let metastr = "";
    if (definitions_1.branchInstructionsOrJump.includes(op.opcode)) {
        metastr = `[${op.imm + originalindex + 1}]`;
    }
    else if (op.opcode == definitions_1.namedClientScriptOps.gosub) {
        metastr = `[${op.imm}]`;
    }
    else if (op.imm != 0) {
        metastr = `[${op.imm}]`;
    }
    return writeCall(ctx, `${getOpcodeName(ctx.calli, op)}${metastr}`, children);
}
const writermap = new Map();
function addWriter(type, writer) {
    writermap.set(type, writer);
}
addWriter(ast_1.ComposedOp, (node, ctx) => {
    if (["++x", "--x", "x++", "x--"].includes(node.type)) {
        if (node.children.length != 0) {
            throw new Error("no children expected on composednode");
        }
        let varname = getOpcodeName(ctx.calli, node.internalOps[0].op);
        if (ctx.int32casts) {
            if (node.type == "++x") {
                return `(${varname} = ${varname} + 1 | 0)`;
            }
            if (node.type == "--x") {
                return `(${varname} = ${varname} - 1 | 0)`;
            }
            if (node.type == "x++") {
                return `(${varname} = ${varname} + 1 | 0, ${varname} - 1 | 0)`;
            }
            if (node.type == "x--") {
                return `(${varname} = ${varname} - 1 | 0, ${varname} + 1 | 0)`;
            }
        }
        else {
            if (node.type == "++x") {
                return `++${varname}`;
            }
            if (node.type == "--x") {
                return `--${varname}`;
            }
            if (node.type == "x++") {
                return `${varname}++`;
            }
            if (node.type == "x--") {
                return `${varname}--`;
            }
        }
    }
    if (node.type == "stack") {
        return writeCall(ctx, "stack", node.children);
    }
    throw new Error("unknown composed op type");
});
addWriter(ast_1.VarAssignNode, (node, ctx) => {
    let res = "";
    let fulldiscard = node.varops.every(q => definitions_1.popDiscardOps.includes(q.op.opcode));
    if (!fulldiscard) {
        let hasglobal = false;
        let hasundeclared = false;
        let varnames = [];
        let exacttypes = [];
        let vardeclared = [];
        for (let sub of node.varops) {
            let name = getOpcodeName(ctx.calli, sub.op);
            let exacttype = -1;
            if (node.knownStackDiff?.exactin) {
                let all = node.knownStackDiff.exactin.all();
                if (all.length != 1) {
                    throw new Error("unexpected");
                }
                let type = ctx.typectx.knowntypes.get(all[0]);
                if (typeof type == "number") {
                    exacttype = type;
                }
            }
            exacttypes.push(exacttype);
            if (definitions_1.popLocalOps.includes(sub.op.opcode)) {
                let isdeclared = ctx.declareLocal(name);
                hasundeclared ||= !isdeclared;
                vardeclared.push(isdeclared);
            }
            else {
                hasglobal = true;
            }
            varnames.push(name);
        }
        if (hasundeclared) {
            if (hasglobal) {
                //we need a "var" expression, but can't add var to the entire destructor operation, add seperate var declarations
                for (let [index, name] of varnames.entries()) {
                    if (vardeclared[index]) {
                        continue;
                    }
                    res += `var ${name}${ctx.typescript ? ":" + (0, definitions_1.subtypeToTs)(exacttypes[index]) : ""};`;
                    res += ctx.codeIndent();
                }
            }
            else {
                res += "var ";
            }
        }
        if (node.varops.length != 1) {
            res += "[";
        }
        res += `${varnames.join(", ")}`;
        if (node.varops.length != 1) {
            res += "]";
        }
        res += " = ";
    }
    res += valueList(ctx, node.children);
    return res;
});
addWriter(ast_1.CodeBlockNode, (node, ctx) => {
    let code = "";
    if (node.parent) {
        code += `{\n`;
        ctx.pushIndent(node.parent instanceof ast_1.ClientScriptFunction);
    }
    // code += `${codeIndent(indent, node.originalindex)}//[${node.scriptid},${node.originalindex}]\n`;
    for (let child of node.children) {
        code += `${ctx.codeIndent(child.originalindex)}${ctx.getCode(child)};\n`;
    }
    if (node.parent) {
        if (node.parent instanceof ast_1.SwitchStatementNode && node.branchEndNode != null) {
            code += `${ctx.codeIndent()}break;\n`;
        }
        if (node.deadcodeSuccessor) {
            code += ctx.getCode(node.deadcodeSuccessor);
        }
        ctx.popIndent();
        code += `${ctx.codeIndent()}}`;
    }
    return code;
});
addWriter(ast_1.BranchingStatement, (node, ctx) => {
    return getOpcodeCallCode(ctx, node.op, node.children, node.originalindex);
});
addWriter(ast_1.WhileLoopStatementNode, (node, ctx) => {
    let res = `while (${ctx.getCode(node.statement)}) `;
    res += ctx.getCode(node.body);
    return res;
});
addWriter(ast_1.SwitchStatementNode, (node, ctx) => {
    let res = "";
    res += `switch (${node.valueop ? ctx.getCode(node.valueop) : ""}) {\n`;
    ctx.pushIndent(false);
    for (let [i, branch] of node.branches.entries()) {
        res += `${ctx.codeIndent(branch.block.originalindex)}case ${branch.value}:`;
        if (i + 1 < node.branches.length && node.branches[i + 1].block == branch.block) {
            res += `\n`;
        }
        else {
            res += " " + ctx.getCode(branch.block);
            res += "\n";
        }
    }
    if (node.defaultbranch) {
        res += `${ctx.codeIndent()}default: `;
        res += ctx.getCode(node.defaultbranch);
        res += `\n`;
    }
    ctx.popIndent();
    res += `${ctx.codeIndent()}}`;
    return res;
});
addWriter(ast_1.IfStatementNode, (node, ctx) => {
    let res = `if (${ctx.getCode(node.statement)}) `;
    res += ctx.getCode(node.truebranch);
    if (node.falsebranch) {
        res += ` else `;
        //skip brackets for else if construct
        let subif = (0, ast_1.getSingleChild)(node.falsebranch, ast_1.IfStatementNode);
        if (subif) {
            res += ctx.getCode(subif);
        }
        else {
            res += ctx.getCode(node.falsebranch);
        }
    }
    return res;
});
addWriter(ast_1.RawOpcodeNode, (node, ctx) => {
    if (node.op.opcode == definitions_1.namedClientScriptOps.pushconst) {
        let exacttype = -1;
        if (node.knownStackDiff?.exactout) {
            let all = node.knownStackDiff.exactout.all();
            if (all.length != 1) {
                throw new Error("unexpected");
            }
            let type = ctx.typectx.knowntypes.get(all[0]);
            if (typeof type == "number") {
                exacttype = type;
            }
        }
        let gettypecast = () => {
            if (!ctx.typescript) {
                return "";
            }
            if (exacttype == -1) {
                return "";
            }
            if (exacttype == definitions_1.subtypes.int || exacttype == definitions_1.subtypes.string || exacttype == definitions_1.subtypes.long) {
                return "";
            }
            if (exacttype == definitions_1.subtypes.unknown_int || exacttype == definitions_1.subtypes.unknown_string || exacttype == definitions_1.subtypes.unknown_long) {
                return "";
            }
            return ` as ${(0, definitions_1.subtypeToTs)(exacttype)}`;
        };
        if (typeof node.op.imm_obj == "string") {
            return `"${escapeStringLiteral(node.op.imm_obj, "double")}"${gettypecast()}`;
        }
        else if (Array.isArray(node.op.imm_obj)) {
            return `${(0, definitions_1.longJsonToBigInt)(node.op.imm_obj)}n${gettypecast()}`;
        }
        else if (typeof node.op.imm_obj == "number") {
            if (exacttype == definitions_1.subtypes.component) {
                let intf = node.op.imm_obj >> 16;
                let sub = node.op.imm_obj & 0xffff;
                if (ctx.usecompoffset && ctx.compoffsets.has(intf)) {
                    return `comprel(${intf},${sub - ctx.compoffsets.get(intf)})`;
                }
                else {
                    return `comp(${intf}, ${sub})`;
                }
            }
            if (exacttype == definitions_1.subtypes.coordgrid && node.op.imm_obj != -1) {
                let v = node.op.imm_obj;
                //plane,chunkx,chunkz,subx,subz
                return `pos(${(v >> 28) & 3},${(v >> 20) & 0xff},${(v >> 6) & 0xff},${(v >> 12) & 0x3f},${v & 0x3f})`;
            }
            if (exacttype == definitions_1.subtypes.boolean) {
                return (node.op.imm_obj == 1 ? "true" : "false");
            }
            return `${node.op.imm_obj}${gettypecast()}`;
        }
        else {
            throw new Error("unexpected");
        }
    }
    if (node.op.opcode == definitions_1.namedClientScriptOps.pushlocalint
        || node.op.opcode == definitions_1.namedClientScriptOps.pushlocallong
        || node.op.opcode == definitions_1.namedClientScriptOps.pushlocalstring
        || node.op.opcode == definitions_1.namedClientScriptOps.pushvar
        || node.op.opcode == definitions_1.namedClientScriptOps.pushvarbit) {
        return getOpcodeName(ctx.calli, node.op);
    }
    if (node.op.opcode == definitions_1.namedClientScriptOps.joinstring) {
        let res = "`";
        for (let child of node.children) {
            if (child instanceof ast_1.RawOpcodeNode && child.opinfo.id == definitions_1.namedClientScriptOps.pushconst && typeof child.op.imm_obj == "string") {
                res += escapeStringLiteral(child.op.imm_obj, "template");
            }
            else {
                res += `\${${ctx.getCode(child)}}`;
            }
        }
        res += "`";
        return res;
    }
    return getOpcodeCallCode(ctx, node.op, node.children, node.originalindex);
});
addWriter(ast_1.ClientScriptFunction, (node, ctx) => {
    let scriptidmatch = node.scriptname.match(/^script(\d+)$/);
    let meta = (scriptidmatch ? ctx.calli.scriptargs.get(+scriptidmatch[1]) : null);
    let res = "";
    res += `//${meta?.scriptname ?? "unknown name"}\n`;
    res += `${ctx.codeIndent()}function ${node.scriptname}(${node.argtype.toTypeScriptVarlist(true, ctx.typescript, meta?.stack.exactin)})`;
    if (ctx.typescript) {
        res += `: ${node.returntype.toTypeScriptReturnType(meta?.stack.exactout)} `;
    }
    res += ctx.getCode(node.children[0]);
    return res;
});
addWriter(ast_1.FunctionBindNode, (node, ctx) => {
    let scriptid = node.children[0]?.knownStackDiff?.constout ?? -1;
    if (scriptid == -1 && node.children.length == 1) {
        return `callback()`;
    }
    return `callback(script${scriptid}${node.children.length > 1 ? ", " : ""}${node.children.slice(1).map(ctx.getCode).join(", ")})`;
});
addWriter(ast_1.SubcallNode, (node, ctx) => {
    return writeCall(ctx, node.funcname, node.children.slice(0, -1));
});
