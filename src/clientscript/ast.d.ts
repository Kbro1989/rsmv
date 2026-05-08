import { clientscript } from "../../generated/clientscript";
import { clientscriptdata } from "../../generated/clientscriptdata";
import { ClientscriptObfuscation, OpcodeInfo } from "./callibrator";
import { StackDiff, StackInOut, StackList, ClientScriptOp, StackConstants } from "./definitions";
import { OpcodeWriterContext } from "./jsonwriter";
import { ClientScriptSubtypeSolver } from "./subtypedetector";
/**
 * known issues
 * - If all branches (and default) of a switch statement return, then the last branch is emptied and its contents are placed after the end of the block (technically still correct)
 *   - has to do with the way the branching detection works (AstNode.findNext)
 * - some op arguments still not figured out
 * - none of this is tested for older builds
 *   - probably breaks at the build where pushconst ops were merged (~700?)
 */
export declare function getSingleChild<T extends AstNode>(op: AstNode | null | undefined, type: {
    new (...args: any[]): T;
}): T | null;
export declare function isNamedOp(op: AstNode, id: number): op is RawOpcodeNode;
export declare abstract class AstNode {
    parent: AstNode | null;
    knownStackDiff: StackInOut | null;
    children: AstNode[];
    originalindex: number;
    constructor(originalindex: number);
    abstract getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
    pushList(nodes: AstNode[]): void;
    push(node: AstNode): void;
    clear(): void;
    unshift(node: AstNode): void;
    replaceChild(oldnode: AstNode, newnode: AstNode): void;
    remove(node: AstNode): void;
}
export declare class SubcallNode extends AstNode {
    funcname: string;
    constructor(originalindex: number, funcname: string, argtype: StackList, returntype: StackList);
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export type ComposedopType = "++x" | "--x" | "x++" | "x--" | "stack";
export declare class ComposedOp extends AstNode {
    type: ComposedopType;
    internalOps: AstNode[];
    constructor(originalindex: number, type: ComposedopType);
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export declare class VarAssignNode extends AstNode {
    varops: RawOpcodeNode[];
    knownStackDiff: StackInOut;
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
    addVar(node: RawOpcodeNode): void;
}
export declare class CodeBlockNode extends AstNode {
    scriptid: number;
    subfuncid: number;
    possibleSuccessors: CodeBlockNode[];
    firstPointer: CodeBlockNode | null;
    lastPointer: CodeBlockNode | null;
    branchEndNode: CodeBlockNode | null;
    deadcodeSuccessor: CodeBlockNode | null;
    maxEndIndex: number;
    knownStackDiff: StackInOut;
    constructor(scriptid: number, subfuncid: number, startindex: number, children?: AstNode[]);
    addSuccessor(block: CodeBlockNode): void;
    mergeBlock(block: CodeBlockNode, flatten: boolean): void;
    findNext(): CodeBlockNode | null;
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
    dump(): void;
}
export declare class BranchingStatement extends AstNode {
    op: ClientScriptOp;
    knownStackDiff: StackInOut;
    constructor(opcodeinfo: ClientScriptOp, originalindex: number);
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export declare class WhileLoopStatementNode extends AstNode {
    statement: AstNode;
    body: CodeBlockNode;
    knownStackDiff: StackInOut;
    constructor(originalindex: number, statement: AstNode, body: CodeBlockNode);
    static fromIfStatement(originalindex: number, originnode: IfStatementNode): WhileLoopStatementNode;
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
type ControlStatementType = "break" | "continue";
export declare class ControlStatementNode extends AstNode {
    type: ControlStatementType;
    constructor(originalindex: number, type: ControlStatementType);
    getOpcodes(ctx: OpcodeWriterContext): never;
}
export declare class SwitchStatementNode extends AstNode {
    branches: {
        value: number;
        block: CodeBlockNode;
    }[];
    valueop: AstNode | null;
    defaultbranch: CodeBlockNode | null;
    knownStackDiff: StackInOut;
    constructor(originalindex: number, valueop: AstNode | null, defaultnode: CodeBlockNode | null, branches: {
        value: number;
        block: CodeBlockNode;
    }[]);
    static create(switchop: RawOpcodeNode, scriptjson: clientscript, nodes: CodeBlockNode[], endindex: number): SwitchStatementNode;
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export declare class IfStatementNode extends AstNode {
    truebranch: CodeBlockNode;
    falsebranch: CodeBlockNode | null;
    statement: AstNode;
    knownStackDiff: StackInOut;
    ifEndIndex: number;
    constructor(originalindex: number);
    setBranches(statement: AstNode, truebranch: CodeBlockNode, falsebranch: CodeBlockNode | null, endindex: number): void;
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export declare class FunctionBindNode extends AstNode {
    constructor(originalindex: number, types: StackList);
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export declare class RawOpcodeNode extends AstNode {
    op: ClientScriptOp;
    opinfo: OpcodeInfo;
    unknownstack: boolean;
    constructor(index: number, op: ClientScriptOp, opinfo: OpcodeInfo);
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export declare class RewriteCursor {
    rootnode: AstNode;
    cursorStack: AstNode[];
    stalled: boolean;
    constructor(node: AstNode);
    current(): AstNode | null;
    setFirstChild(target: AstNode, stall?: boolean): AstNode | null;
    remove(): AstNode | null;
    rebuildStack(): void;
    replaceNode(newnode: AstNode): AstNode;
    next(): AstNode | null;
    prev(): AstNode | null;
    setNextNode(node: AstNode): void;
    goToStart(): AstNode | null;
    goToEnd(): null;
}
export declare function getNodeStackOut(node: AstNode): StackList;
export declare function getNodeStackIn(node: AstNode): StackList;
export declare function translateAst(ast: CodeBlockNode): CodeBlockNode;
export declare class ClientScriptFunction extends AstNode {
    returntype: StackList;
    argtype: StackList;
    scriptname: string;
    localCounts: StackDiff;
    isRawStack: boolean;
    constructor(scriptname: string, argtype: StackList, returntype: StackList, localCounts: StackDiff);
    getOpcodes(ctx: OpcodeWriterContext): ClientScriptOp[];
}
export declare function varArgtype(stringconst: string | unknown, lastintconst: number | unknown): StackList | null;
export declare function setRawOpcodeStackDiff(consts: StackConstants | null, calli: ClientscriptObfuscation, node: RawOpcodeNode): void;
export declare function generateAst(calli: ClientscriptObfuscation, script: clientscriptdata | clientscript, ops: ClientScriptOp[], scriptid: number): {
    sections: CodeBlockNode[];
    rootfunc: ClientScriptFunction;
    subfuncs: ClientScriptFunction[];
};
export declare function parseClientScriptIm(calli: ClientscriptObfuscation, script: clientscript, fileid?: number): {
    rootfunc: ClientScriptFunction;
    sections: CodeBlockNode[];
    typectx: ClientScriptSubtypeSolver;
};
export {};
