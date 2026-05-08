import { AstNode } from "./ast";
import { ClientscriptObfuscation } from "./callibrator";
import { ClientScriptSubtypeSolver } from "./subtypedetector";
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
export declare function debugAst(node: AstNode): void;
export declare class TsWriterContext {
    calli: ClientscriptObfuscation;
    typectx: ClientScriptSubtypeSolver;
    indents: boolean[];
    declaredVars: Set<string>[];
    compoffsets: Map<number, number>;
    usecompoffset: boolean;
    int32casts: boolean;
    typescript: boolean;
    constructor(calli: ClientscriptObfuscation, typectx: ClientScriptSubtypeSolver);
    setCompOffsets(rootnode: AstNode): void;
    codeIndent(linenr?: number, hasquestionmark?: boolean): string;
    pushIndent(hasScope: boolean): void;
    popIndent(): void;
    declareLocal(varname: string): boolean;
    getCode: (node: AstNode) => string;
}
