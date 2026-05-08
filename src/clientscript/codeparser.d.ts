import { ClientScriptFunction } from "./ast";
import { ClientscriptObfuscation } from "./callibrator";
export declare function parseClientscriptTs(deob: ClientscriptObfuscation, code: string): import("../libs/yieldparser").ParseResult<ClientScriptFunction>;
export declare function writeOpcodeFile(calli: ClientscriptObfuscation): string;
export declare function writeClientVarFile(calli: ClientscriptObfuscation): string;
