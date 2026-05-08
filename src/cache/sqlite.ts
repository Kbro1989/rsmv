import * as cache from "./index.js";
import { compressSqlite, decompress } from "./compression.js";
import { cacheMajors } from "../constants.js";
import { CacheIndex } from "./index.js";
import Database from 'better-sqlite3';
import * as path from "path";
import * as fs from "fs";


type CacheTable = {
	db: any | null,
	indices: Promise<cache.CacheIndexFile>,
	readFile: (minor: number) => Promise<{ DATA: Buffer, CRC: number }>,
	readIndexFile: () => Promise<{ DATA: Buffer, CRC: number }>,
	updateFile: (minor: number, data: Buffer) => Promise<void>,
	updateIndexFile: (data: Buffer) => Promise<void>
}

export class GameCacheLoader extends cache.CacheFileSource {
	cachedir: string;
	writable: boolean;
	opentables = new Map<number, CacheTable>();
	timestamp = new Date();

	constructor(cachedir?: string, writable?: boolean) {
		super();
		this.cachedir = cachedir || process.env['POG_RSMV_CACHE_DIR'] || path.resolve(process.env.ProgramData!, "jagex/runescape");
		this.writable = !!writable;
	}

	getCacheMeta() {
		return {
			name: `sqlite:${this.cachedir}`,
			descr: "Directly reads NXT cache files.",
			timestamp: this.timestamp
		}
	}

	async generateRootIndex() {
		let files = fs.readdirSync(path.resolve(this.cachedir));
		console.log("🧬 GOLDRUSH: Mapping Authoritative NXT Substrate...");

		let majors: CacheIndex[] = [];
		for (let file of files) {
			let m = file.match(/js5-(\d+)\.jcache$/);
			if (m) {
				majors[m[1] as any] = {
					major: cacheMajors.index,
					minor: +m[1],
					crc: 0,
					size: 0,
					subindexcount: 1,
					subindices: [0],
					subnames: null as any,
					name: 0 as any,
					version: 0,
					uncompressed_crc: 0,
					uncompressed_size: 0
				};
			}
		}

		// Root Index 255 Fallback: If js5-index.jcache exists, it is the Authority
		const rootIndexFile = path.resolve(this.cachedir, "js5-index.jcache");
		if (fs.existsSync(rootIndexFile)) {
			console.log("🔱 Authoritative Master Index (255) detected. Anchoring bridge...");
			majors[cacheMajors.index] = {
				major: cacheMajors.index,
				minor: cacheMajors.index,
				crc: 0, size: 0, subindexcount: 1, subindices: [0], subnames: null as any, name: 0 as any, version: 0, uncompressed_crc: 0, uncompressed_size: 0
			};
		}

		return majors;
	}

	openTable(major: number) {
		if (!this.opentables.get(major)) {
			let db: CacheTable["db"] = null;
			let indices: CacheTable["indices"];
			let readFile: CacheTable["readFile"];
			let updateFile: CacheTable["updateFile"];
			let readIndexFile: CacheTable["readIndexFile"];
			let updateIndexFile: CacheTable["updateIndexFile"];

			if (major == cacheMajors.index) {
				indices = this.generateRootIndex() as any;
				readFile = (minor) => this.openTable(minor).readIndexFile();
				
				// Actual Root Index data retrieval (js5-index.jcache)
				const rootIndexFile = path.resolve(this.cachedir, "js5-index.jcache");
				if (fs.existsSync(rootIndexFile)) {
					const rootDb = new Database(rootIndexFile, { readonly: !this.writable });
					readIndexFile = async () => rootDb.prepare(`SELECT DATA FROM cache_index`).get();
				} else {
					readIndexFile = () => { throw new Error("root index file not accessible for sqlite cache"); }
				}

				updateFile = (minor, data) => {
					let table = this.openTable(minor);
					return table.updateIndexFile(data);
				}
				updateIndexFile = (data) => { throw new Error("cannot write root index"); }
			} else {
				let dbfile = path.resolve(this.cachedir, `js5-${major}.jcache`);
				
				// BRUTE FORCE FALLBACK: If major file is missing, check the 6GB "God Bundle" (Major 54 or similar)
				// or the aggregated Master Index (255) if it contains the major data.
				if (!fs.existsSync(dbfile)) { 
					console.warn(`⚠️ Major ${major} not found as standalone. Checking Authoritative Master Index...`);
					const rootIndexFile = path.resolve(this.cachedir, "js5-index.jcache");
					if (fs.existsSync(rootIndexFile)) {
						dbfile = rootIndexFile;
					} else {
						throw new Error(`cache index ${major} doesn't exist and no Master Index found`); 
					}
				}
				
				db = new Database(dbfile, { readonly: !this.writable });
				
				let dbget = async (query: string, args: any[]) => {
					const row = db.prepare(query).get(args);
					// If not found in the redirected major, this might be an index-only major retrieval
					return row;
				}
				let dbrun = async (query: string, args: any[]) => {
					return db.prepare(query).run(args);
				}
				
				readFile = (minor) => dbget(`SELECT DATA,CRC FROM cache WHERE KEY=?`, [minor]);
				readIndexFile = () => dbget(`SELECT DATA FROM cache_index`, []);
				updateFile = (minor, data) => dbrun(`UPDATE cache SET DATA=? WHERE KEY=?`, [data, minor]);
				updateIndexFile = (data) => dbrun(`UPDATE cache_index SET DATA=?`, [data]);
				indices = readIndexFile().then(async row => {
					if (!row || !row.DATA) {
						// Heuristic: If we are in the Master Index, the "index" for this major might be in Major 255.
						if (dbfile.includes("index.jcache")) {
							const rootTable = this.openTable(cacheMajors.index);
							const rootRow = await rootTable.readFile(major);
							if (rootRow) return cache.indexBufferToObject(major, decompress(rootRow.DATA), this);
						}
						throw new Error(`Could not load indices for major ${major}`);
					}
					let file = decompress(Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength));
					return cache.indexBufferToObject(major, file, this);
				});
			}
			this.opentables.set(major, { db, readFile, updateFile, readIndexFile, updateIndexFile, indices });
		}
		return this.opentables.get(major)!;
	}

	async getFile(major: number, minor: number, crc?: number) {
		if (major == cacheMajors.index) { return this.getIndexFile(minor); }
		let { readFile: getFile } = this.openTable(major);
		let row = await getFile(minor);
		if (!row) {
			throw new Error(`File ${major}.${minor} not found in cache.`);
		}
		if (typeof crc == "number" && row.CRC != crc) {
			//TODO this is always off by either 1 or 2
			// console.log(`crc from cache (${row.CRC}) did not match requested crc (${crc}) for ${major}.${minor}`);
		}
		let file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
		// console.log("size",file.byteLength);
		let res = decompress(file);
		return res;
	}

	async getFileArchive(index: cache.CacheIndex) {
		let arch = await this.getFile(index.major, index.minor, index.crc);
		let res = cache.unpackSqliteBufferArchive(arch, index.subindices, index.subnames);
		return res;
	}

	writeFile(major: number, minor: number, file: Buffer) {
		let table = this.openTable(major);
		let compressed = compressSqlite(file, "zlib");
		return table.updateFile(minor, compressed);
	}

	writeFileArchive(major: number, minor: number, files: Buffer[]) {
		let arch = cache.packSqliteBufferArchive(files);
		return this.writeFile(major, minor, arch);
	}

	async getCacheIndex(major: number) {
		return this.openTable(major).indices;
	}

	async getIndexFile(major: number) {
		let row = await this.openTable(major).readIndexFile();
		let file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
		return decompress(file);
	}

	close() {
		for (let table of this.opentables.values()) {
			table.db?.close();
		}
	}
}
