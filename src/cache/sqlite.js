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
exports.GameCacheLoader = void 0;
const cache = __importStar(require("./index"));
const compression_1 = require("./compression");
const constants_1 = require("../constants");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class GameCacheLoader extends cache.CacheFileSource {
    cachedir;
    writable;
    opentables = new Map();
    timestamp = new Date();
    constructor(cachedir, writable) {
        super();
        this.cachedir = cachedir || process.env['POG_RSMV_CACHE_DIR'] || path.resolve(process.env.ProgramData, "jagex/runescape");
        this.writable = !!writable;
    }
    getCacheMeta() {
        return {
            name: `sqlite:${this.cachedir}`,
            descr: "Directly reads NXT cache files.",
            timestamp: this.timestamp
        };
    }
    async generateRootIndex() {
        let files = fs.readdirSync(path.resolve(this.cachedir));
        console.log("using generated cache index file meta, crc size and version missing");
        let majors = [];
        for (let file of files) {
            let m = file.match(/js5-(\d+)\.jcache$/);
            if (m) {
                majors[m[1]] = {
                    major: constants_1.cacheMajors.index,
                    minor: +m[1],
                    crc: 0,
                    size: 0,
                    subindexcount: 1,
                    subindices: [0],
                    version: 0,
                    uncompressed_crc: 0,
                    uncompressed_size: 0
                };
            }
        }
        return majors;
    }
    openTable(major) {
        let sqlite = __non_webpack_require__("sqlite3");
        if (!this.opentables.get(major)) {
            let db = null;
            let indices;
            let readFile;
            let updateFile;
            let readIndexFile;
            let updateIndexFile;
            if (major == constants_1.cacheMajors.index) {
                indices = this.generateRootIndex();
                readFile = (minor) => this.openTable(minor).readIndexFile();
                readIndexFile = () => { throw new Error("root index file not accesible for sqlite cache"); };
                updateFile = (minor, data) => {
                    let table = this.openTable(minor);
                    return table.updateIndexFile(data);
                };
                updateIndexFile = (data) => { throw new Error("cannot write root index"); };
            }
            else {
                let dbfile = path.resolve(this.cachedir, `js5-${major}.jcache`);
                //need separate throw here since sqlite just crashes instead of throwing
                if (!fs.existsSync(dbfile)) {
                    throw new Error(`cache index ${major} doesn't exist`);
                }
                db = new sqlite.Database(dbfile, this.writable ? sqlite.OPEN_READWRITE : sqlite.OPEN_READONLY);
                let ready = new Promise(done => db.once("open", done));
                let dbget = async (query, args) => {
                    await ready;
                    return new Promise((resolve, reject) => {
                        db.get(query, args, (err, row) => {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve(row);
                            }
                        });
                    });
                };
                let dbrun = async (query, args) => {
                    await ready;
                    return new Promise((resolve, reject) => {
                        db.run(query, args, (err, res) => {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve(res);
                            }
                        });
                    });
                };
                readFile = (minor) => dbget(`SELECT DATA,CRC FROM cache WHERE KEY=?`, [minor]);
                readIndexFile = () => dbget(`SELECT DATA FROM cache_index`, []);
                updateFile = (minor, data) => dbrun(`UPDATE cache SET DATA=? WHERE KEY=?`, [data, minor]);
                updateIndexFile = (data) => dbrun(`UPDATE cache_index SET DATA=?`, [data]);
                indices = readIndexFile().then(async (row) => {
                    let file = (0, compression_1.decompress)(Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength));
                    return cache.indexBufferToObject(major, file, this);
                });
            }
            this.opentables.set(major, { db, readFile, updateFile, readIndexFile, updateIndexFile, indices });
        }
        return this.opentables.get(major);
    }
    async getFile(major, minor, crc) {
        if (major == constants_1.cacheMajors.index) {
            return this.getIndexFile(minor);
        }
        let { readFile: getFile } = this.openTable(major);
        let row = await getFile(minor);
        if (typeof crc == "number" && row.CRC != crc) {
            //TODO this is always off by either 1 or 2
            // console.log(`crc from cache (${row.CRC}) did not match requested crc (${crc}) for ${major}.${minor}`);
        }
        let file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
        // console.log("size",file.byteLength);
        let res = (0, compression_1.decompress)(file);
        return res;
    }
    async getFileArchive(index) {
        let arch = await this.getFile(index.major, index.minor, index.crc);
        let res = cache.unpackSqliteBufferArchive(arch, index.subindices, index.subnames);
        return res;
    }
    writeFile(major, minor, file) {
        let table = this.openTable(major);
        let compressed = (0, compression_1.compressSqlite)(file, "zlib");
        return table.updateFile(minor, compressed);
    }
    writeFileArchive(major, minor, files) {
        let arch = cache.packSqliteBufferArchive(files);
        return this.writeFile(major, minor, arch);
    }
    async getCacheIndex(major) {
        return this.openTable(major).indices;
    }
    async getIndexFile(major) {
        let row = await this.openTable(major).readIndexFile();
        let file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
        return (0, compression_1.decompress)(file);
    }
    close() {
        for (let table of this.opentables.values()) {
            table.db?.close();
        }
    }
}
exports.GameCacheLoader = GameCacheLoader;
