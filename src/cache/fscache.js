"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSourceFsCache = void 0;
const sqlite3wrap_1 = require("../libs/sqlite3wrap");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const dbpath = "./cache/fscache.sqlite3";
class FileSourceFsCache {
    ready;
    isready;
    database;
    getstatement;
    setstatement;
    static tryCreate() {
        if (typeof __non_webpack_require__ == "undefined") {
            return null;
        }
        try {
            __non_webpack_require__("sqlite3");
        }
        catch {
            return null;
        }
        return new FileSourceFsCache(dbpath);
    }
    constructor(filename) {
        this.isready = false;
        this.ready = (async () => {
            await fs.mkdir(path.dirname(filename), { recursive: true });
            let database = await (0, sqlite3wrap_1.sqliteOpenDatabase)(filename, { create: true, write: true });
            await (0, sqlite3wrap_1.sqliteExec)(database, `CREATE TABLE IF NOT EXISTS groupcache (major INT, minor INT, crc UNSIGNED INT, file BLOB);`);
            await (0, sqlite3wrap_1.sqliteExec)(database, `CREATE UNIQUE INDEX IF NOT EXISTS mainindex ON groupcache(major,minor,crc)`);
            this.getstatement = await (0, sqlite3wrap_1.sqlitePrepare)(database, `SELECT major, minor, crc, file FROM groupcache WHERE major=? AND minor=? AND crc=?`);
            this.setstatement = await (0, sqlite3wrap_1.sqlitePrepare)(database, `INSERT INTO groupcache(major,minor,crc,file) VALUES (?,?,?,?)`);
            this.isready = true;
        })();
    }
    async addFile(major, minor, crc, file) {
        if (!this.isready) {
            await this.ready;
        }
        console.log("saving", major, minor, crc, "len", file.length);
        (0, sqlite3wrap_1.sqliteRunStatement)(this.setstatement, [major, minor, crc, file]);
    }
    async getFile(major, minor, crc) {
        if (!this.isready) {
            await this.ready;
        }
        let cached = await (0, sqlite3wrap_1.sqliteRunStatement)(this.getstatement, [major, minor, crc]);
        if (cached.length > 1) {
            throw new Error("more than one match for fs cached file");
        }
        if (cached.length == 1) {
            if (!cached[0].file) {
                throw new Error(`file ${major}.${minor} not found (explicitly missing in cache)`);
            }
            return cached[0].file;
        }
        return null;
    }
}
exports.FileSourceFsCache = FileSourceFsCache;
