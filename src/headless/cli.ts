import { createRequire } from "module";
const require = createRequire(import.meta.url);
if (typeof (globalThis as any).__non_webpack_require__ === "undefined") {
	(globalThis as any).__non_webpack_require__ = require;
}

if (typeof (globalThis as any).ImageData === "undefined") {
	(globalThis as any).ImageData = class ImageData {
		width: number;
		height: number;
		data: Uint8ClampedArray;
		colorSpace: string;
		constructor(data: Uint8ClampedArray, width: number, height: number, opts?: { colorSpace?: string }) {
			this.data = data;
			this.width = width;
			this.height = height;
			this.colorSpace = opts?.colorSpace || 'srgb';
		}
	};
}

if (typeof (globalThis as any).Blob === "undefined") {
	(globalThis as any).Blob = class Blob {
		parts: any[];
		options: any;
		constructor(parts: any[], options: any) {
			this.parts = parts;
			this.options = options;
			// console.log("Blob created with", parts.length, "parts");
		}
		async arrayBuffer() {
			// console.log("Blob.arrayBuffer called");
			return Buffer.concat(this.parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p as any)));
		}
	} as any;
}

if (typeof (globalThis as any).FileReader === "undefined") {
	(globalThis as any).FileReader = class FileReader {
		onload: any;
		onloadend: any;
		onerror: any;
		result: any;
		readAsArrayBuffer(blob: any) {
			// console.log("FileReader.readAsArrayBuffer called");
			if (blob.arrayBuffer) {
				blob.arrayBuffer().then((buf: any) => {
					// console.log("FileReader.readAsArrayBuffer: blob.arrayBuffer resolved");
					this.result = buf;
					if (this.onload) this.onload({ target: this });
					if (this.onloadend) this.onloadend({ target: this });
				}).catch((e: any) => {
					console.error("FileReader.readAsArrayBuffer: blob.arrayBuffer rejected", e);
					if (this.onerror) this.onerror(e);
					if (this.onloadend) this.onloadend({ target: this });
				});
			} else {
				// console.log("FileReader.readAsArrayBuffer: fallback path");
				setTimeout(() => {
					this.result = blob;
					if (this.onload) this.onload({ target: this });
					if (this.onloadend) this.onloadend({ target: this });
				}, 0);
			}
		}
		readAsDataURL(blob: any) {
			// console.log("FileReader.readAsDataURL called");
			setTimeout(() => {
				this.result = "data:application/octet-stream;base64,";
				if (this.onload) this.onload({ target: this });
				if (this.onloadend) this.onloadend({ target: this });
			}, 0);
		}
		readAsText(blob: any) {
			// console.log("FileReader.readAsText called");
			setTimeout(() => {
				this.result = "";
				if (this.onload) this.onload({ target: this });
				if (this.onloadend) this.onloadend({ target: this });
			}, 0);
		}
	} as any;
}

if (typeof (globalThis as any).URL === "undefined") {
	(globalThis as any).URL = {
		createObjectURL: (blob: any) => "",
		revokeObjectURL: (url: string) => { }
	} as any;
}


if (typeof (globalThis as any).navigator === "undefined") {
	(globalThis as any).navigator = {
		userAgent: "Node.js"
	} as any;
}

const MockCanvas = class {
	width = 0;
	height = 0;
	style = {};
	getContext(id: string) {
		if (id == "2d") return {
			drawImage: () => { },
			putImageData: () => { },
			getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
			createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
			fillRect: () => { },
			clearRect: () => { },
			fill: () => { },
			stroke: () => { },
			beginPath: () => { },
			moveTo: () => { },
			lineTo: () => { },
			arc: () => { },
			scale: () => { },
			rotate: () => { },
			translate: () => { },
			save: () => { },
			restore: () => { },
		};
		return null;
	}
	toBlob(cb: any) {
		setTimeout(() => cb(new (globalThis as any).Blob([], { type: "image/png" })), 0);
	}
	toDataURL() { return "data:image/png;base64,"; }
	addEventListener() { }
	removeEventListener() { }
	getRootNode() { return this; }
};

if (typeof (globalThis as any).document === "undefined") {
	(globalThis as any).document = {
		createElement: (tag: string) => {
			if (tag == "canvas") return new (MockCanvas as any)();
			return { style: {} };
		}
	} as any;
}

import { cliArguments, filesource } from "../cliparser";
import * as cmdts from "cmd-ts";
import { renderAppearance, runServer } from "./api";
import { EngineCache, ThreejsSceneCache } from "../3d/modeltothree";
import { promises as fs } from "fs";

let cmd = cmdts.command({
	name: "render",
	args: {
		...filesource,
		model: cmdts.option({ long: "model", short: "m", defaultValue: () => "" }),
		head: cmdts.flag({ long: "head" }),
		endpoint: cmdts.option({ long: "endpoint", short: "e", defaultValue: () => "" }),
		auth: cmdts.option({ long: "auth", short: "p", defaultValue: () => "" }),
		analyze: cmdts.flag({ long: "analyze" }),
		wiki: cmdts.option({ long: "wiki", defaultValue: () => "" })
	},
	handler: async (args) => {
		let src = await args.source();
		if (args.endpoint) {
			await runServer(src, args.endpoint, args.auth);
		} else {
			const { StructuralAnalyzer } = await import("./StructuralAnalyzer.js");
			let engine = await EngineCache.create(src);
			let scene = await ThreejsSceneCache.create(engine);

			let ava: { imgfile: Buffer; modelfile: Buffer };
			const modelStr = args.model;

			if (modelStr.startsWith('npc:')) {
				const id = modelStr.split(':')[1];
				ava = await renderAppearance(scene, 'npc', id, args.head);
			} else if (modelStr.startsWith('item:')) {
				const id = modelStr.split(':')[1];
				ava = await renderAppearance(scene, 'item', id, args.head);
			} else {
				let modelparts = modelStr.split(":");
				ava = await renderAppearance(scene, modelparts[0] as any, modelparts[1], args.head);
			}

			await fs.writeFile("model.png", ava.imgfile);
			await fs.writeFile("model.glb", Buffer.from(ava.modelfile));

			if (args.analyze) {
				let wikiData = { role: 'Unknown', intent: 'Studied asset', url: '' };
				if (args.wiki) {
					try {
						if (args.wiki.startsWith('{')) {
							wikiData = JSON.parse(args.wiki);
						} else {
							const wikiFile = await fs.readFile(args.wiki, 'utf8');
							wikiData = JSON.parse(wikiFile);
						}
					} catch (e) {
						console.error("Failed to parse wiki data:", e);
					}
				}
				const profile = await StructuralAnalyzer.analyze(modelStr, modelStr, "model.glb", wikiData);
				await fs.writeFile("pedagogy_profile.json", JSON.stringify(profile, null, 2));
				console.log("pedagogy profile generated.");
			}
		}
	}
});

cmdts.runSafely(cmd, cliArguments()).then(res => {
	if (res._tag === "error") {
		console.error("CLI Error Result:");
		console.error(res.error.config.message);
		process.exit(1);
	}
}).catch(err => {
	console.error("Top-level Exception:");
	console.error(err);
	if (err.stack) console.error(err.stack);
	process.exit(1);
});