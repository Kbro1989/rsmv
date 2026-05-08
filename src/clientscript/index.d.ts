import { ClientscriptObfuscation } from "./callibrator";
import { CacheFileSource } from "../cache";
import { clientscript } from "../../generated/clientscript";
export { writeClientVarFile, writeOpcodeFile } from "../clientscript/codeparser";
export declare function compileClientScript(source: CacheFileSource, code: string): Promise<clientscript>;
export declare function renderClientScript(source: CacheFileSource, buf: Buffer, fileid: number, relativeComps?: boolean, notypes?: boolean, int32casts?: boolean): Promise<string>;
export declare function prepareClientScript(source: CacheFileSource): Promise<ClientscriptObfuscation>;
export declare function clientscriptHash(script: clientscript): number;
