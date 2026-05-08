export type ScriptState = "running" | "canceled" | "error" | "done";
export type ScriptFSEntry = {
    name: string;
    kind: "file" | "directory";
};
export interface ScriptOutput {
    state: ScriptState;
    log(...args: any[]): void;
    setUI(ui: HTMLElement | null): void;
    setState(state: ScriptState): void;
    run<ARGS extends any[], RET extends any>(fn: (output: ScriptOutput, ...args: [...ARGS]) => Promise<RET>, ...args: ARGS): Promise<RET | null>;
}
export interface ScriptFS {
    mkDir(name: string): Promise<any>;
    writeFile(name: string, data: Buffer | string): Promise<void>;
    readFileText(name: string): Promise<string>;
    readFileBuffer(name: string): Promise<Buffer>;
    readDir(dir: string): Promise<ScriptFSEntry[]>;
    copyFile(from: string, to: string, symlink: boolean): Promise<void>;
    unlink(name: string): Promise<void>;
}
export declare function naiveDirname(filename: string): string;
export declare class CLIScriptFS implements ScriptFS {
    dir: string;
    copyOnSymlink: boolean;
    constructor(dir: string);
    convertPath(sub: string): string;
    mkDir(name: string): Promise<string | undefined>;
    writeFile(name: string, data: Buffer | string): Promise<void>;
    readFileBuffer(name: string): Promise<NonSharedBuffer>;
    readFileText(name: string): Promise<string>;
    readDir(name: string): Promise<{
        name: string;
        kind: "file" | "directory";
    }[]>;
    unlink(name: string): Promise<void>;
    copyFile(from: string, to: string, symlink: boolean): Promise<void>;
}
export declare class CLIScriptOutput implements ScriptOutput {
    state: ScriptState;
    log: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    setUI(ui: HTMLElement | null): void;
    setState(state: ScriptState): void;
    run<ARGS extends any[], RET extends any>(fn: (output: ScriptOutput, ...args: ARGS) => Promise<RET>, ...args: ARGS): Promise<RET | null>;
}
