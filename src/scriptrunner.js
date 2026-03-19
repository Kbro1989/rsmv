"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIScriptOutput = exports.CLIScriptFS = void 0;
exports.naiveDirname = naiveDirname;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function naiveDirname(filename) {
    return filename.split("/").slice(0, -1).join("/");
}
class CLIScriptFS {
    dir;
    copyOnSymlink = true;
    constructor(dir) {
        this.dir = path_1.default.resolve(dir);
        if (dir) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    convertPath(sub) {
        let target = path_1.default.resolve(this.dir, sub.replace(/^\//g, ""));
        //make sure the result is indeed a subfolder of the fs
        let rel = path_1.default.relative(this.dir, target);
        if (target != this.dir && (rel.startsWith("..") || path_1.default.isAbsolute(rel))) {
            throw new Error("Error while converting CLIScriptFS path");
        }
        return target;
    }
    mkDir(name) {
        return fs_1.default.promises.mkdir(this.convertPath(name), { recursive: true });
    }
    writeFile(name, data) {
        return fs_1.default.promises.writeFile(this.convertPath(name), data);
    }
    readFileBuffer(name) {
        return fs_1.default.promises.readFile(this.convertPath(name));
    }
    readFileText(name) {
        return fs_1.default.promises.readFile(this.convertPath(name), "utf-8");
    }
    async readDir(name) {
        let files = await fs_1.default.promises.readdir(this.convertPath(name), { withFileTypes: true });
        return files.map(q => ({ name: q.name, kind: (q.isDirectory() ? "directory" : "file") }));
    }
    unlink(name) {
        return fs_1.default.promises.unlink(this.convertPath(name));
    }
    copyFile(from, to, symlink) {
        if (!symlink || this.copyOnSymlink) {
            //don't actually symliink because its weird in windows
            return fs_1.default.promises.copyFile(this.convertPath(from), this.convertPath(to));
        }
        else {
            return fs_1.default.promises.symlink(this.convertPath(to), this.convertPath(from));
        }
    }
}
exports.CLIScriptFS = CLIScriptFS;
class CLIScriptOutput {
    state = "running";
    //bind instead of call so the original call site is retained while debugging
    log = console.log.bind(console);
    setUI(ui) {
        if (ui && typeof document != "undefined") {
            document.body.appendChild(ui);
        }
    }
    setState(state) {
        this.state = state;
    }
    async run(fn, ...args) {
        try {
            return await fn(this, ...args);
        }
        catch (e) {
            console.warn(e);
            if (this.state != "canceled") {
                this.log(e);
                this.setState("error");
            }
            return null;
        }
        finally {
            if (this.state == "running") {
                this.setState("done");
            }
        }
    }
}
exports.CLIScriptOutput = CLIScriptOutput;
