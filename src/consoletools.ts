import { CacheFileSource } from "./cache";
import { unpackCoordgrid } from "./utils";
import { cliApi, CliApiContext } from "./clicommands";
import * as cmdts from "cmd-ts";
import { cacheConfigPages, internalNameFiles, cacheMajors, vartypes } from "./constants";
import { dumpTexture } from "./imgutils";
import { CLIScriptOutput } from "./scriptrunner";
import { cacheFilenameHash, HSL2RGB, packedHSL2HSL } from "./utils";
import prettyJson from "json-stringify-pretty-compact";
import { UIScriptFS } from "./viewer/scriptsui";
import { EngineCache } from "./3d/modeltothree";
import { cacheFileDecodeModes } from "./parser/filetypes";

// exposes various tools into the global scope to use in the console for debugging and testing
export function exposeDebugToolsInGlobal() {
    const debugGlobal = globalThis as Record<string, any>;
    debugGlobal.cacheMajors = cacheMajors;
    debugGlobal.cacheConfigPages = cacheConfigPages;
    debugGlobal.internalNameFiles = internalNameFiles;
    debugGlobal.vartypes = vartypes;
    debugGlobal.dumpjson = dumpjson;
    debugGlobal.bin = bin;
    debugGlobal.binarr = binarr;
    debugGlobal.findnames = findnames;
    debugGlobal.allnames = allnames;
    debugGlobal.dumptex = dumpTexture;
    debugGlobal.cacheFilenameHash = cacheFilenameHash;
    debugGlobal.hsl = (v: number) => HSL2RGB(packedHSL2HSL(v));
    debugGlobal.coordgrid = coordgrid;
    debugGlobal.prettyjson = prettyJson;
    debugGlobal.cli = cli;
    debugGlobal.getFileCounts = getFileCounts;
    debugGlobal.getConfigCount = getConfigCount;
}

function coordgrid(coord: number) {
    let { level, x, z } = unpackCoordgrid(coord);
    return `${level}_${x}_${z}`;
}

async function cli(args: string) {
    let source = (globalThis as typeof globalThis & { source: CacheFileSource }).source;
    let cliconsole = new CLIScriptOutput();
    let outputs: Record<string, any> = {};

    let clictx: CliApiContext = {
        getConsole() { return cliconsole; },
        getFs(name: string) { return outputs[name] ??= new UIScriptFS(null); },
        getDefaultCache() { return source; }
    }
    let api = cliApi(clictx);
    let res = await cmdts.runSafely(api.subcommands, args.split(/\s+/g));
    if (cliconsole.state == "running") {
        cliconsole.setState(res._tag == "error" ? "error" : "done");
    }
    if (res._tag == "error") {
        console.error(res.error.config.message);
        outputs.code = res.error.config.exitCode;
    } else {
        outputs.code = 0;
        // console.log("cmd completed", res.value);
    }
    return outputs;
}

async function getFileCounts() {
    let source = (globalThis as typeof globalThis & { source: CacheFileSource }).source;
    let res: Record<string, any> = {};
    for (let modename in cacheFileDecodeModes) {
        let modefactory = cacheFileDecodeModes[modename as keyof typeof cacheFileDecodeModes];
        try {
            let mode = modefactory({});
            let fileids = await mode.logicalRangeToFiles(source, [0, 0], [Infinity, Infinity]);

            let lastfile = fileids.at(-1);
            if (lastfile) {
                let lastindex = mode.fileToLogical(source, lastfile.index.major, lastfile.index.minor, lastfile.subindex);
                res[modename] = (Array.isArray(lastindex) && lastindex.length == 1 ? lastindex[0] : lastindex);
            }
        } catch (e) {
            res[modename] = e;
        }
    }
    return res;
}

async function getConfigCount() {
    let source = (globalThis as typeof globalThis & { source: CacheFileSource }).source;
    let w = await source.getCacheIndex(2)
    return w.map(q => ({ id: q.minor, count: q.subindexcount, max: q.subindices.at(-1), name: Object.entries(cacheConfigPages).find(w => w[1] == q.minor)?.[0] }))
}

async function dumpjson(mode: string) {
    let engine = (globalThis as typeof globalThis & { engine: EngineCache }).engine;
    let res = await engine.getJsonSearchData(mode).files;
    let remapped: any[] = [];
    for (let f of res) {
        remapped[f.$fileid] = f;
    }
    return remapped;
}

function bin(arr: any[]) {
    let bins: Record<string, number[]> = {};
    for (let i = 0; i < arr.length; i++) {
        let key = String(arr[i]);
        if (!bins[key]) { bins[key] = []; }
        bins[key].push(i);
    }
    return bins;
}

function binarr(arr: any[][]) {
    let bins: Record<string, number[]> = {};
    for (let i = 0; i < arr.length; i++) {
        let sub = arr[i];
        if (sub) {
            for (let j = 0; j < sub.length; j++) {
                let key = String(sub[j]);
                if (!bins[key]) { bins[key] = []; }
                bins[key].push(i);
            }
        }
    }
    return bins;
}

async function findnames(id: number) {
    let source = (globalThis as typeof globalThis & { source: CacheFileSource }).source;
    let names: Record<string, string | undefined> = {};
    for (let group in internalNameFiles) {
        names[group] = await source.getInternalName(internalNameFiles[group as keyof typeof internalNameFiles], id);
    }
    return names;
}

async function allnames() {
    let source = (globalThis as typeof globalThis & { source: CacheFileSource }).source;
    let res: Record<number, any> = {};
    let index = await source.getCacheIndex(cacheMajors.filenames);
    for (let entry of index) {
        if (!entry) { continue; }
        res[entry.minor] = await source.getInternalNameList(entry.minor);
    }
    return res;
}