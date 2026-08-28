import { clientscript } from "../../generated/clientscript";
import { clientscriptdata } from "../../generated/clientscriptdata";
import type { ClientscriptObfuscation, OpcodeInfo } from "./callibrator";
import { debugAst } from "./codewriter";
import { branchInstructions, branchInstructionsOrJump, dynamicOps, typeToPrimitive, namedClientScriptOps, variableSources, StackDiff, StackInOut, StackList, StackTypeExt, ClientScriptOp, StackConst, StackType, StackConstants, getParamOps, subtypes, branchInstructionsInt, branchInstructionsLong, ExactStack, dependencyGroup, dependencyIndex, typeuuids, getOpName, makeop, getArgType, getReturnType } from "./definitions";
import { OpcodeWriterContext, intrinsics } from "./jsonwriter";

export function getSingleChild<T extends AstNode>(op: AstNode | null | undefined, type: { new(...args: any[]): T }) {
    if (!op || op.children.length != 1 || !(op.children[0] instanceof type)) { return null; }
    return op.children[0] as T;
}

export function isNamedOp(op: AstNode, id: number): op is RawOpcodeNode {
    return op instanceof RawOpcodeNode && op.op.opcode == id;
}

export abstract class AstNode {
    parent: AstNode | null = null;
    knownStackDiff: StackInOut | null = null;
    children: AstNode[] = [];
    originalindex: number;
    constructor(originalindex: number) {
        this.originalindex = originalindex;
    }
    abstract getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
    pushList(nodes: AstNode[]) {
        for (let node of nodes) {
            if (node.parent == this) { continue; }
            node.parent = null;//prevents parent array shuffle
            this.push(node);
        }
    }
    push(node: AstNode) {
        if (node == this) { throw new Error("tried to add self to ast children"); }
        node.parent?.remove(node);
        this.children.push(node);
        node.parent = this;
    }
    clear() {
        this.children.forEach(q => q.parent = null);
        this.children.length = 0;
    }
    unshift(node: AstNode) {
        node.parent?.remove(node);
        this.children.unshift(node);
        node.parent = this;
    }
    replaceChild(oldnode: AstNode, newnode: AstNode) {
        if (newnode == this) { throw new Error("tried to add self to ast children"); }
        newnode.parent?.remove(newnode);
        let index = this.children.indexOf(oldnode);
        if (index == -1) { throw new Error("tried to replace node that isn't a child"); }
        newnode.parent = this;
        oldnode.parent = null;
        this.children[index] = newnode;
    }
    remove(node: AstNode) {
        let index = this.children.indexOf(node);
        if (index == -1) { throw new Error("tried to remove node that isn't a child"); }
        this.children.splice(index, 1);
        node.parent = null;
    }
}

export class SubcallNode extends AstNode {
    funcname: string;
    constructor(originalindex: number, funcname: string, argtype: StackList, returntype: StackList) {
        super(originalindex);
        this.funcname = funcname;
        let args = argtype.clone();
        args.pushone("int");//return address
        this.knownStackDiff = new StackInOut(args, returntype);
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        let body = this.children.slice(0, -1).flatMap(q => q.getOpcodes(ctx));
        body.push(...ctx.makeSubCallOps(this.funcname));
        return body;
    }
}

export type ComposedopType = "++x" | "--x" | "x++" | "x--" | "stack";
export class ComposedOp extends AstNode {
    type: ComposedopType;
    internalOps: AstNode[] = [];
    constructor(originalindex: number, type: ComposedopType) {
        super(originalindex);
        this.type = type;
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        if (this.type != "stack" && this.children.length != 0) { throw new Error("no children expected on composednode"); }
        return this.children.flatMap(q => q.getOpcodes(ctx))
            .concat(this.internalOps.flatMap(q => q.getOpcodes(ctx)));
    }
}

export class VarAssignNode extends AstNode {
    varops: RawOpcodeNode[] = [];
    knownStackDiff = new StackInOut(new StackList(), new StackList());
    getOpcodes(ctx: OpcodeWriterContext) {
        let res = this.children.flatMap(q => q.getOpcodes(ctx));
        return res.concat(this.varops.flatMap(q => q.getOpcodes(ctx)).reverse());
    }
    addVar(node: RawOpcodeNode) {
        this.varops.unshift(node);
        this.knownStackDiff.in.push(getNodeStackIn(node));
    }
}

export class CodeBlockNode extends AstNode {
    scriptid: number;
    subfuncid: number;
    possibleSuccessors: CodeBlockNode[] = [];
    firstPointer: CodeBlockNode | null = null;
    lastPointer: CodeBlockNode | null = null;
    branchEndNode: CodeBlockNode | null = null;
    deadcodeSuccessor: CodeBlockNode | null = null;
    maxEndIndex = -1;

    knownStackDiff = new StackInOut(new StackList(), new StackList());
    constructor(scriptid: number, subfuncid: number, startindex: number, children?: AstNode[]) {
        super(startindex);
        this.scriptid = scriptid;
        this.subfuncid = subfuncid;
        if (children) {
            this.pushList(children);
        }
    }
    addSuccessor(block: CodeBlockNode) {
        if (this.originalindex < block.originalindex && (!block.firstPointer || this.originalindex < block.firstPointer.originalindex)) {
            block.firstPointer = this;
        }
        if (this.originalindex > block.originalindex && (!block.lastPointer || this.originalindex > block.lastPointer.originalindex)) {
            block.lastPointer = this;
            block.maxEndIndex = this.originalindex;
        }
        if (!block) { throw new Error("added null successor"); }
        this.possibleSuccessors.push(block);
    }
    mergeBlock(block: CodeBlockNode, flatten: boolean) {
        if (flatten) {
            this.pushList(block.children);
            block.children.length = 0;
        } else {
            this.push(block);
        }
        this.possibleSuccessors = block.possibleSuccessors;
        this.branchEndNode = block.branchEndNode;
        this.deadcodeSuccessor = block.deadcodeSuccessor;
    }
    findNext() {
        if (!this.branchEndNode) {
            if (this.possibleSuccessors.length == 0) {
                this.branchEndNode = null;
            } else if (this.possibleSuccessors.length == 1) {
                if (this.possibleSuccessors[0].originalindex < this.originalindex) {
                    this.branchEndNode = null;//looping jump
                } else {
                    this.branchEndNode = this.possibleSuccessors[0];
                }
            } else {
                let optionstates = this.possibleSuccessors.slice() as (CodeBlockNode | null)[];
                while (true) {
                    let first: CodeBlockNode | null = null;
                    for (let op of optionstates) {
                        if (op && (first == null || op.originalindex < first.originalindex)) {
                            first = op;
                        }
                    }
                    if (!first) {
                        this.branchEndNode = null;
                        break;
                    }
                    if (optionstates.every(q => !q || q == first)) {
                        this.branchEndNode = first;
                        break;
                    }
                    optionstates[optionstates.indexOf(first)] = first.findNext();
                }
            }
        }
        return this.branchEndNode;
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        return this.children.flatMap(q => {
            if (q instanceof ClientScriptFunction) {
                ctx.addSubfunction(q);
                return [];
            } else {
                return q.getOpcodes(ctx);
            }
        });
    }
    dump() {
        debugAst(this);
    }
}

export function retargetJumps(ctx: OpcodeWriterContext, code: ClientScriptOp[], from: number, to: number) {
    let lastop = code.at(-1);
    let insertedcount = 0;
    if (lastop && lastop.opcode != namedClientScriptOps.jump && from == 0) {
        let jumpop = ctx.calli.getNamedOp(namedClientScriptOps.jump);
        code.push({ opcode: jumpop.id, imm: to - 1, imm_obj: null });
        insertedcount++;
    }
    for (let index = 0; index < code.length; index++) {
        let op = code[index];
        if (branchInstructionsOrJump.includes(op.opcode)) {
            let target = index + 1 + op.imm;
            if (target >= code.length - insertedcount) {
                target += insertedcount;
            }
            if (target == code.length + from) {
                target = code.length + to;
            }
            op.imm = target - index - 1;
        }
    }
}

export class BranchingStatement extends AstNode {
    op: ClientScriptOp;
    knownStackDiff = new StackInOut(new StackList(["int", "int"]), new StackList(["int"]));
    constructor(opcodeinfo: ClientScriptOp, originalindex: number) {
        super(originalindex);
        this.op = opcodeinfo;
    }

    getOpcodes(ctx: OpcodeWriterContext) {
        if (this.op.opcode == namedClientScriptOps.shorting_or || this.op.opcode == namedClientScriptOps.shorting_and) {
            if (this.children.length != 2) { throw new Error("unexpected"); }
            let left = this.children[0].getOpcodes(ctx);
            let right = this.children[1].getOpcodes(ctx);
            if (this.op.opcode == namedClientScriptOps.shorting_or) {
                retargetJumps(ctx, left, 1, right.length + 1);
            } else {
                retargetJumps(ctx, left, 0, right.length);
                retargetJumps(ctx, left, 1, 0);
            }
            return [...left, ...right];
        }
        let op: ClientScriptOp = { opcode: this.op.opcode, imm: 1, imm_obj: null };
        return this.children.flatMap(q => q.getOpcodes(ctx)).concat(op);
    }
}

export class WhileLoopStatementNode extends AstNode {
    statement: AstNode;
    body: CodeBlockNode;
    knownStackDiff = new StackInOut(new StackList(), new StackList());
    constructor(originalindex: number, statement: AstNode, body: CodeBlockNode) {
        super(originalindex);
        this.statement = statement;
        this.body = body;
        this.push(statement);
        this.push(body);
    }
    static fromIfStatement(originalindex: number, originnode: IfStatementNode) {
        if (originnode.falsebranch) { throw new Error("cannot have else branch in loop"); }
        if (!originnode.parent) { throw new Error("unexpected"); }
        return new WhileLoopStatementNode(originalindex, originnode.statement, originnode.truebranch);
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        let cond = this.statement.getOpcodes(ctx);
        let body = this.body.getOpcodes(ctx);
        let jump = ctx.calli.getNamedOp(namedClientScriptOps.jump);
        cond.push({ opcode: jump.id, imm: body.length + 1, imm_obj: null });
        body.push({ opcode: jump.id, imm: -(body.length + 1 + cond.length), imm_obj: null });
        return [...cond, ...body];
    }
}

type ControlStatementType = "break" | "continue";
export class ControlStatementNode extends AstNode {
    type: ControlStatementType;
    constructor(originalindex: number, type: ControlStatementType) {
        super(originalindex);
        this.type = type;
    }
    getOpcodes(ctx: OpcodeWriterContext): never {
        throw new Error("break/continue statements failed to process. only break at end of switch case supported");
    }
}

export class SwitchStatementNode extends AstNode {
    branches: { value: number, block: CodeBlockNode }[] = [];
    valueop: AstNode | null;
    defaultbranch: CodeBlockNode | null = null;
    knownStackDiff = new StackInOut(new StackList(["int"]), new StackList());
    constructor(originalindex: number, valueop: AstNode | null, defaultnode: CodeBlockNode | null, branches: { value: number, block: CodeBlockNode }[]) {
        super(originalindex);
        this.valueop = valueop;
        this.defaultbranch = defaultnode;
        this.branches = branches;
        if (valueop) {
            this.push(valueop);
        }
        this.pushList(branches.map(q => q.block));
        if (defaultnode) {
            this.push(defaultnode);
        }
    }
    static create(switchop: RawOpcodeNode, scriptjson: clientscript, nodes: CodeBlockNode[], endindex: number) {
        let valueop: AstNode | null = switchop.children[0] ?? null;
        let branches: { value: number, block: CodeBlockNode }[] = [];

        let cases = scriptjson.switches[switchop.op.imm];
        if (!cases) { throw new Error("no matching cases in script"); }
        for (let casev of cases) {
            let node = nodes.find(q => q.originalindex == switchop.originalindex + 1 + casev.jump);
            if (!node) { throw new Error("switch case branch not found"); }
            branches.push({ value: casev.value, block: node });
            node.maxEndIndex = endindex;
            if (node.originalindex != switchop.originalindex + 1 + casev.jump) {
                throw new Error("switch branches don't match");
            }
        }

        let defaultblock: CodeBlockNode | null = nodes.find(q => q.originalindex == switchop.originalindex + 1) ?? null;
        let defaultblockjump = getSingleChild(defaultblock, RawOpcodeNode);
        if (defaultblock && defaultblockjump && defaultblockjump.opinfo.id == namedClientScriptOps.jump) {
            if (defaultblock.possibleSuccessors.length != 1) { throw new Error("jump successor branch expected"); }
            defaultblock = defaultblock.possibleSuccessors[0];
            if (defaultblock.originalindex == endindex) {
                defaultblock = null;
            }
        }

        if (defaultblock) {
            defaultblock.maxEndIndex = endindex;
        }
        return new SwitchStatementNode(switchop.originalindex, valueop, defaultblock, branches);
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        let body: ClientScriptOp[] = [];
        if (this.valueop) { body.push(...this.valueop.getOpcodes(ctx)); }
        let jump = ctx.calli.getNamedOp(namedClientScriptOps.jump);
        let switchopinfo = ctx.calli.getNamedOp(namedClientScriptOps.switch);
        let switchop: ClientScriptOp = { opcode: switchopinfo.id, imm: -1, imm_obj: null };
        let defaultjmp: ClientScriptOp = { opcode: jump.id, imm: -1, imm_obj: null };
        body.push(switchop);
        let jumpstart = body.length;
        body.push(defaultjmp);

        let endops: ClientScriptOp[] = [];

        let jumptable: ClientScriptOp["imm_obj"] = { type: "switchvalues", value: [] };
        let lastblock: CodeBlockNode | null = null;
        let lastblockindex = 0;
        for (let i = 0; i < this.branches.length; i++) {
            let branch = this.branches[i];
            if (branch.block == lastblock) {
                jumptable.value.push({ value: branch.value, jump: lastblockindex });
                continue;
            }
            if (lastblock) {
                let jmp: ClientScriptOp = { opcode: jump.id, imm: -1, imm_obj: null };
                body.push(jmp);
                endops.push(jmp);
            }
            lastblock = branch.block;
            lastblockindex = body.length - jumpstart;
            jumptable.value.push({ value: branch.value, jump: lastblockindex });
            body.push(...branch.block.getOpcodes(ctx));
        }

        if (this.defaultbranch) {
            if (lastblock) {
                let jmp: ClientScriptOp = { opcode: jump.id, imm: -1, imm_obj: null };
                body.push(jmp);
                endops.push(jmp);
            }

            defaultjmp.imm = body.length - body.indexOf(defaultjmp) - 1;
            body.push(...this.defaultbranch.getOpcodes(ctx));
        } else {
            endops.push(defaultjmp);
        }

        for (let op of endops) {
            let index = body.indexOf(op);
            op.imm = body.length - index - 1;
        }

        switchop.imm_obj = jumptable;

        return body;
    }
}

export class IfStatementNode extends AstNode {
    truebranch!: CodeBlockNode;
    falsebranch!: CodeBlockNode | null;
    statement!: AstNode;
    knownStackDiff = new StackInOut(new StackList(["int"]), new StackList());
    ifEndIndex!: number;
    constructor(originalindex: number) {
        super(originalindex);
    }
    setBranches(statement: AstNode, truebranch: CodeBlockNode, falsebranch: CodeBlockNode | null, endindex: number) {
        if (truebranch == falsebranch) { throw new Error("unexpected"); }
        this.ifEndIndex = endindex;
        this.statement = statement;
        this.push(statement);

        this.truebranch = truebranch;
        truebranch.maxEndIndex = this.ifEndIndex;

        this.falsebranch = falsebranch;
        if (falsebranch) {
            falsebranch.maxEndIndex = this.ifEndIndex;
        }

        if (falsebranch && falsebranch.originalindex < truebranch.originalindex) {
            this.push(falsebranch);
        }
        this.push(truebranch);
        if (falsebranch && falsebranch.originalindex >= truebranch.originalindex) {
            this.push(falsebranch);
        }
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        let cond = this.statement.getOpcodes(ctx);
        let truebranch = this.truebranch.getOpcodes(ctx);
        let falsebranch: ClientScriptOp[] = [];
        if (this.falsebranch) {
            falsebranch = this.falsebranch.getOpcodes(ctx);
            truebranch.push({ opcode: ctx.calli.getNamedOp(namedClientScriptOps.jump).id, imm: falsebranch.length, imm_obj: null });
        }
        retargetJumps(ctx, cond, 0, truebranch.length == 1 ? 2 : truebranch.length);
        retargetJumps(ctx, cond, 1, 0);
        if (truebranch.length == 1) { retargetJumps(ctx, cond, 2, 1); }
        return [...cond, ...truebranch, ...falsebranch];
    }
}

export class FunctionBindNode extends AstNode {
    constructor(originalindex: number, types: StackList) {
        super(originalindex);
        let intype = types.clone();
        intype.values.unshift("int");
        this.knownStackDiff = new StackInOut(intype, new StackList(["int", "vararg"]));
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        let scriptid = this.children[0]?.knownStackDiff?.constout ?? -1;
        if (typeof scriptid != "number") { throw new Error("unexpected"); }
        let typestring = "";
        if (scriptid != -1) {
            let func = ctx.calli.scriptargs.get(scriptid);
            if (!func) { throw new Error("unknown functionbind types"); }
            typestring = func.stack.in.toFunctionBindString();
        }
        let ops = this.children.flatMap(q => q.getOpcodes(ctx)).concat();
        ops.push({ opcode: namedClientScriptOps.pushconst, imm: 2, imm_obj: typestring });
        return ops;
    }
}

export class RawOpcodeNode extends AstNode {
    op: ClientScriptOp;
    opinfo: OpcodeInfo;
    unknownstack = false;
    constructor(index: number, op: ClientScriptOp, opinfo: OpcodeInfo) {
        super(index);
        this.op = op;
        this.opinfo = opinfo;
    }
    getOpcodes(ctx: OpcodeWriterContext) {
        let body = this.children.flatMap(q => q.getOpcodes(ctx));
        body.push({ ...this.op });
        return body;
    }
}

export class RewriteCursor {
    rootnode: AstNode;
    cursorStack: AstNode[] = [];
    stalled = true;
    constructor(node: AstNode) {
        this.rootnode = node;
    }
    current() {
        return this.cursorStack.at(-1) ?? null;
    }
    setFirstChild(target: AstNode, stall = false) {
        this.stalled = stall;
        if (target != this.cursorStack.at(-1)) {
            this.cursorStack.push(target);
        }
        while (target.children.length != 0) {
            target = target.children[0];
            this.cursorStack.push(target);
        }
        return this.cursorStack.at(-1) ?? null;
    }
    remove() {
        let node = this.current();
        let newcurrent = this.prev();
        if (!node) { throw new Error("no node selected"); }
        if (!node.parent) { throw new Error("cannot remove root node"); }
        node.parent.remove(node);
        return newcurrent;
    }
    rebuildStack() {
        let current = this.current();
        this.cursorStack.length = 0;
        for (let node = current; node; node = node.parent) {
            this.cursorStack.unshift(node);
        }
    }
    replaceNode(newnode: AstNode) {
        let node = this.current();
        if (!node) { throw new Error("no node selected"); }
        if (!node.parent) { throw new Error("cannot replace root node"); }
        node.parent.replaceChild(node, newnode);
        this.cursorStack[this.cursorStack.length - 1] = newnode;
        return newnode;
    }
    next() {
        if (this.stalled) {
            this.stalled = false;
            if (this.cursorStack.length == 0) {
                this.goToStart();
            }
            return this.current();
        }
        let currentnode = this.cursorStack.at(-1);
        let parentnode = this.cursorStack.at(-2);
        if (!currentnode) { return null; }
        this.cursorStack.pop();
        if (!parentnode) { return null; }

        let index = parentnode.children.indexOf(currentnode);
        if (index == parentnode.children.length - 1) {
            return parentnode;
        }
        let newnode = parentnode.children[index + 1];
        return this.setFirstChild(newnode);
    }
    prev() {
        if (this.stalled) {
            this.stalled = false;
            return this.current();
        }
        let currentnode = this.cursorStack.at(-1);
        if (!currentnode) { return null; }
        if (currentnode.children.length != 0) {
            let newnode = currentnode.children.at(-1)!;
            this.cursorStack.push(newnode);
            return newnode;
        }
        while (true) {
            this.cursorStack.pop();
            let parentnode = this.cursorStack.at(-1);
            if (!parentnode || !currentnode) {
                this.cursorStack.length = 0;
                this.stalled = true;
                return null;
            }

            let index = parentnode.children.indexOf(currentnode);
            if (index >= 1) {
                let newnode = parentnode.children[index - 1];
                this.cursorStack.push(newnode);
                return newnode;
            }
            currentnode = parentnode;
        }
    }
    setNextNode(node: AstNode) {
        this.stalled = true;
        this.cursorStack.length = 0;
        for (let current: AstNode | null = node; current; current = current.parent) {
            this.cursorStack.unshift(current);
        }
    }
    goToStart() {
        this.stalled = false;
        this.cursorStack.length = 0;
        return this.setFirstChild(this.rootnode);
    }
    goToEnd() {
        this.stalled = false;
        this.cursorStack.length = 0;
        return null;
    }
}

export function getNodeStackOut(node: AstNode) {
    if (node.knownStackDiff) {
        return node.knownStackDiff.out;
    }
    if (node instanceof RawOpcodeNode && node.opinfo.stackinfo) {
        return node.opinfo.stackinfo.out;
    }
    console.log("unknown stack out");
    return new StackList();
}

export function getNodeStackIn(node: AstNode) {
    if (node.knownStackDiff) {
        return node.knownStackDiff.in;
    }
    if (node instanceof RawOpcodeNode && node.opinfo.stackinfo) {
        return node.opinfo.stackinfo.in;
    }
    console.log("unknown stack in");
    return new StackList();
}

export class ClientScriptFunction extends AstNode {
    returntype: StackList;
    argtype: StackList;
    scriptname: string;
    localCounts: StackDiff;
    isRawStack = false;
    constructor(scriptname: string, argtype: StackList, returntype: StackList, localCounts: StackDiff) {
        super(0);
        this.scriptname = scriptname;
        this.returntype = returntype;
        this.argtype = argtype;
        this.localCounts = localCounts;
        this.knownStackDiff = new StackInOut(new StackList(), new StackList());
    }

    getOpcodes(ctx: OpcodeWriterContext) {
        let body = this.children[0].getOpcodes(ctx);
        if (!this.returntype.isEmpty() || body.at(-1)?.opcode != namedClientScriptOps.return) {
            let ret = this.returntype.clone();
            let pushconst = (type: StackType) => {
                if (type == "vararg") { throw new Error("unexpected"); }
                body.push({
                    opcode: namedClientScriptOps.pushconst,
                    imm: { int: 0, long: 1, string: 2 }[type],
                    imm_obj: { int: 0, long: [0, 0] as [number, number], string: "" }[type],
                });
            }
            while (!ret.isEmpty()) {
                let type = ret.values.pop()!;
                if (type instanceof StackDiff) {
                    for (let i = 0; i < type.int; i++) { pushconst("int"); }
                    for (let i = 0; i < type.long; i++) { pushconst("long"); }
                    for (let i = 0; i < type.string; i++) { pushconst("string"); }
                    for (let i = 0; i < type.vararg; i++) { pushconst("vararg"); }
                } else {
                    pushconst(type);
                }
            }
            body.push({ opcode: namedClientScriptOps.return, imm: 0, imm_obj: null });
        }
        return body;
    }
}

export function varArgtype(stringconst: string | unknown, lastintconst: number | unknown) {
    if (typeof stringconst != "string") { return null; }
    let varargmatch = stringconst.match(/^([ils]*)Y?$/);
    if (!varargmatch) {
        return null;
    }
    let indiff = new StackList(varargmatch[1].split("").flatMap<StackType>(q => q == "i" ? "int" : q == "l" ? "long" : q == "s" ? "string" : null!));
    if (stringconst.includes("Y")) {
        if (typeof lastintconst != "number") {
            throw new Error("parsing vararg array, but length type was not an int");
        }
        for (let i = 0; i < lastintconst; i++) { indiff.int(); }
        indiff.int();
    }
    return indiff;
}
