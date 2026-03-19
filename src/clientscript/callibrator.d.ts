import { CacheFileSource } from "../cache";
import { FileParser } from "../opdecoder";
import { DecodeState, EncodeState } from "../opcode_reader";
import { clientscriptdata } from "../../generated/clientscriptdata";
import { clientscript } from "../../generated/clientscript";
import { params } from "../../generated/params";
import { ClientScriptOp, ImmediateType, StackDiff, StackInOut, StackList } from "./definitions";
import { dbtables } from "../../generated/dbtables";
import { CodeBlockNode } from "./ast";
import { detectSubtypes as callibrateSubtypes } from "./subtypedetector";
export type StackDiffEquation = {
    section: CodeBlockNode;
    unknowns: Set<OpcodeInfo>;
};
declare let varInfoParser: FileParser<{
    type: number;
}>;
declare var varbitInfoParser: FileParser<{
    varid: number;
    bits: [number, number];
}>;
export declare class OpcodeInfo {
    scrambledid: number;
    id: number;
    possibleTypes: Set<ImmediateType>;
    type: ImmediateType | "unknown";
    stackinfo: StackInOut;
    stackChangeConstraints: Set<StackDiffEquation>;
    constructor(scrambledid: number, id: number, possibles: ImmediateType[]);
    static fromJson(json: ReturnType<OpcodeInfo["toJson"]>): OpcodeInfo;
    toJson(): {
        id: number;
        scrambledid: number;
        stackinfo: {
            in: (StackDiff | import("./definitions").StackType)[];
            out: (StackDiff | import("./definitions").StackType)[];
            initializedthrough: boolean;
            exactin: import("./definitions").ExactStack | undefined;
            exactout: import("./definitions").ExactStack | undefined;
        };
        type: "unknown" | ImmediateType;
    };
}
export type ScriptCandidate = {
    id: number;
    scriptname: string;
    solutioncount: number;
    buf: Buffer;
    script: clientscriptdata;
    scriptcontents: clientscript | null;
    returnType: StackList | null;
    argtype: StackDiff | null;
    unknowns: Map<number, OpcodeInfo>;
    didmatch: boolean;
};
type ReferenceScript = {
    id: number;
    scriptdata: clientscriptdata;
    scriptops: ClientScriptOp[];
};
type ReferenceCallibration = {
    buildnr: number;
    scripts: ReferenceScript[];
    decodedMappings: Map<number, OpcodeInfo>;
    opidcounter: number;
};
export type ReadOpCallback = (state: DecodeState) => ClientScriptOp;
export declare class ClientscriptObfuscation {
    mappings: Map<number, OpcodeInfo>;
    decodedMappings: Map<number, OpcodeInfo>;
    isNonObbedCache: boolean;
    candidatesLoaded: boolean;
    foundEncodings: boolean;
    foundParameters: boolean;
    foundSubtypes: boolean;
    opidcounter: number;
    source: CacheFileSource;
    dbtables: Map<number, dbtables>;
    varmeta: Map<number, {
        name: string;
        maxid: number;
        vars: Map<number, typeof varInfoParser extends FileParser<infer T> ? T : never>;
    }>;
    varbitmeta: Map<number, typeof varbitInfoParser extends FileParser<infer T> ? T : never>;
    parammeta: Map<number, params>;
    scriptargs: Map<number, {
        scriptname: string;
        stack: StackInOut;
    }>;
    candidates: Map<number, ScriptCandidate>;
    static fromJson(source: CacheFileSource, deobjson: ReturnType<ClientscriptObfuscation["toJson"]>, scriptjson: null | ReturnType<ClientscriptObfuscation["getScriptJson"]>): Promise<ClientscriptObfuscation>;
    toJson(): {
        buildnr: number;
        mappings: {
            id: number;
            scrambledid: number;
            stackinfo: {
                in: (StackDiff | import("./definitions").StackType)[];
                out: (StackDiff | import("./definitions").StackType)[];
                initializedthrough: boolean;
                exactin: import("./definitions").ExactStack | undefined;
                exactout: import("./definitions").ExactStack | undefined;
            };
            type: "unknown" | ImmediateType;
        }[];
        opidcounter: number;
    };
    getScriptJson(): {
        scriptargs: {
            id: number;
            scriptname: string;
            stack: {
                in: (StackDiff | import("./definitions").StackType)[];
                out: (StackDiff | import("./definitions").StackType)[];
                initializedthrough: boolean;
                exactin: import("./definitions").ExactStack | undefined;
                exactout: import("./definitions").ExactStack | undefined;
            };
        }[];
    };
    static getSaveName(source: CacheFileSource): Promise<{
        opcodename: string;
        scriptname: string;
    }>;
    save(): Promise<void>;
    private constructor();
    static create(source: CacheFileSource, nocached?: boolean): Promise<ClientscriptObfuscation>;
    declareOp(rawopid: number, types: ImmediateType[]): OpcodeInfo;
    preloadData(): Promise<void>;
    loadCandidates(idstart?: number, idend?: number): Promise<void>;
    parseCandidateContents(): void;
    generateDump(): {
        buildnr: number;
        scripts: ReferenceScript[];
        decodedMappings: Map<number, OpcodeInfo>;
        opidcounter: number;
    };
    runAutoCallibrate(source: CacheFileSource): Promise<void>;
    runCallibrationFrom(refscript: ReferenceCallibration): Promise<void>;
    findOpcodeImmidiates: typeof findOpcodeImmidiates;
    callibrateOperants: typeof callibrateOperants;
    callibrateSubtypes: typeof callibrateSubtypes;
    setNonObbedMappings(): void;
    writeOpCode: (state: EncodeState, v: unknown) => void;
    readOpcode: ReadOpCallback;
    getClientVarMeta(varint: number): {
        name: string;
        varid: number;
        type: import("./definitions").PrimitiveType;
        fulltype: number;
    } | null;
    getNamedOp(id: number): OpcodeInfo;
}
declare function findOpcodeImmidiates(calli: ClientscriptObfuscation): {
    test(id: number): void;
    getop(opid: number): ScriptCandidate[];
    candidates: ScriptCandidate[];
    runtheories: (cand: ScriptCandidate, chained: ({
        script: clientscriptdata;
        endoffset: number;
        opsleft: number;
        opid: number;
        type: ImmediateType;
        children: /*elided*/ any[];
        parent: /*elided*/ any | null;
    } | null)[]) => {
        script: clientscriptdata;
        endoffset: number;
        opsleft: number;
        opid: number;
        type: ImmediateType;
        children: /*elided*/ any[];
        parent: /*elided*/ any | null;
    }[] | null;
    evaluateSolution: (updateCandidate: ScriptCandidate | null, solutions: {
        script: clientscriptdata;
        endoffset: number;
        opsleft: number;
        opid: number;
        type: ImmediateType;
        children: /*elided*/ any[];
        parent: /*elided*/ any | null;
    }[], maxsols?: number) => number;
    testCascade(ipop: number): number | "too many states" | "could not expand problem further";
};
declare function callibrateOperants(calli: ClientscriptObfuscation, candidates: Map<number, ScriptCandidate>): void;
export declare function getArgType(script: clientscriptdata | clientscript): StackDiff;
export declare function getReturnType(calli: ClientscriptObfuscation, ops: ClientScriptOp[], endindex?: number): StackList;
export {};
