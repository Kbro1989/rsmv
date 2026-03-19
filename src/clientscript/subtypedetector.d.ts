import { CodeBlockNode } from "./ast";
import { ClientscriptObfuscation, ScriptCandidate } from "./callibrator";
export declare class ClientScriptSubtypeSolver {
    map: Map<number, Set<number>>;
    knowntypes: Map<number, number>;
    uuidcounter: number;
    constructor();
    entangle(key: number, other: number | undefined): void;
    parseSections(sections: CodeBlockNode[]): void;
    addKnownFromCalli(calli: ClientscriptObfuscation): void;
    solve(): void;
}
export declare function detectSubtypes(calli: ClientscriptObfuscation, candidates: Map<number, ScriptCandidate>): void;
export declare function assignKnownTypes(calli: ClientscriptObfuscation, knowntypes: Map<number, number>): Map<number, number>;
