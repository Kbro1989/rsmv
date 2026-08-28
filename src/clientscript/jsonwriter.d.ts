import { clientscript } from "../../generated/clientscript";
import { ClientScriptFunction } from "./ast";
import { ClientscriptObfuscation } from "./callibrator";
import { StackDiff, ClientScriptOp, StackList } from "./definitions";
export declare class OpcodeWriterContext {
    calli: ClientscriptObfuscation;
    tempcounts: StackDiff;
    labels: Map<ClientScriptOp, number>;
    namedLabels: Map<string, ClientScriptOp>;
    subfunctions: Map<string, {
        label: ClientScriptOp;
        func: ClientScriptFunction;
    }>;
    returntableLabel: ClientScriptOp | null;
    returnsites: Map<number, ClientScriptOp>;
    returnsiteidcounter: number;
    constructor(calli: ClientscriptObfuscation);
    makeReturnOp(): {
        opcode: number;
        imm: number;
        imm_obj: {
            type: "jumplabel";
            value: ClientScriptOp;
        };
    };
    getSubfunctionLabel(name: string): ClientScriptOp;
    makeSubCallOps(funcname: string): ClientScriptOp[];
    declareLabel(op: ClientScriptOp): void;
    addSubfunction(func: ClientScriptFunction): void;
}
export declare const intrinsics: Map<string, {
    in: StackList;
    out: StackList;
    write: (ctx: OpcodeWriterContext) => ClientScriptOp[];
}>;
/**
 * This type of subfunction allows raw access to the stack, however calls to other functions or intrinsics aren't allowed
 */
export declare function writeRawStackSubFunction(ctx: OpcodeWriterContext, subfunc: {
    label: ClientScriptOp;
    func: ClientScriptFunction;
}): ClientScriptOp[];
export declare function writeSubFunction(ctx: OpcodeWriterContext, subfunc: {
    label: ClientScriptOp;
    func: ClientScriptFunction;
}): ClientScriptOp[];
export declare function astToImJson(calli: ClientscriptObfuscation, func: ClientScriptFunction): clientscript;
export declare function mergeScriptJsons(script1: clientscript, script2: clientscript, secret: number): clientscript;
