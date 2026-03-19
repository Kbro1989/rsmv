
import { CacheFileSource } from "../cache";
import { EngineCache, ThreejsSceneCache } from "../3d/modeltothree";
import { delay } from "../utils";
import { Vector3, WebGLRendererParameters } from "three";
import { appearanceUrl, avatarStringToBytes } from "../3d/avatar";
import { pixelsToImageFile } from "../imgutils";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

// Polyfill window and animation frames for Three.js headless context
if (typeof globalThis.window === 'undefined') {
	(globalThis as any).window = globalThis;
	if (!globalThis.requestAnimationFrame) {
		globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 1000 / 60) as any;
		globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id as any);
	}
}

//TODO remove bypass cors, since we are in a browser context and the runeapps server isn't cooperating atm
// Use globalThis.fetch; if not available (node-fetch), it should be polyfilled/imported in the entry point.
// @ts-ignore
const fetchPolyfill = globalThis.fetch;

export { CacheDownloader } from "../cache/downloader";
export { GameCacheLoader } from "../cache/sqlite";
export { CallbackCacheLoader } from "../cache";
export * as map from "../map/index";
import type { ScriptOutput, CLIScriptOutput } from "../scriptrunner";
export type { ScriptOutput, CLIScriptOutput };
//export buffer since we're polyfilling it in browsers
export const BufferPoly = Buffer;

export async function runServer(source: CacheFileSource, endpoint: string, auth: string) {
	let backoff = 1;
	while (true) {
		let res = false;
		try {
			res = await runConnection(source, endpoint, auth);
		} catch { }
		if (!res) {
			await delay(backoff * 1000);
			backoff = Math.min(5 * 60, backoff * 2);
		} else {
			await delay(1000);
			backoff = 1;
		}
	}
}


function runConnection(source: CacheFileSource, endpoint: string, auth: string) {
	return new Promise<boolean>(async (done, err) => {
		let engine = await EngineCache.create(source);
		let ws = new WebSocket(endpoint);
		let didopen = false;
		ws.onopen = () => { ws.send(auth); didopen = true; };
		ws.onclose = () => done(didopen);
		ws.onerror = () => done(didopen);
		ws.onmessage = async (msg) => {
			let packet = JSON.parse(msg.data);
			try {
				let scene = await ThreejsSceneCache.create(engine);
				if (packet.type == "player") {
					let ava = await renderAppearance(scene, "player", packet.data);
					ws.send(JSON.stringify({
						reqid: packet.reqid,
						type: "modelbase64",
						data: {
							model: ava.modelfile.toString("base64"),
							image: ava.imgfile.toString("base64")
						}
					}));
				} else if (packet.type == "appearance") {
					let ava = await renderAppearance(scene, "appearance", packet.data);
					ws.send(JSON.stringify({
						reqid: packet.reqid,
						type: "modelbase64",
						data: {
							model: ava.modelfile.toString("base64"),
							image: ava.imgfile.toString("base64")
						}
					}));
				} else {
					throw new Error("unknown packet type " + packet.type);
				}
			}
			catch (e) {
				ws.send(JSON.stringify({
					reqid: packet.reqid,
					type: "err",
					data: e + ""
				}));
			}
		}
	});
}

export async function getRenderer(width: number, height: number, extraopts?: WebGLRendererParameters) {
	let opts = Object.assign({ antialias: true, alpha: true } as WebGLRendererParameters, extraopts);

	let cnv: HTMLCanvasElement;
	let ctx: WebGLRenderingContext | undefined = undefined;
	if (typeof HTMLCanvasElement != "undefined") {
		//browser/electron/puppeteer
		cnv = document.createElement("canvas");
		cnv.width = width;
		cnv.height = height;
	} else {
		//nodejs "gl" implementation, currently not maintained
		cnv = {
			width, height,
			clientWidth: width, clientHeight: height,
			addEventListener: (event: string, cb: any) => { },
			removeEventListener: (event: string, cb: any) => { },
			getRootNode: () => cnv,
			style: {}
		} as any;
		try {
			ctx = __non_webpack_require__("gl")(width, height, opts);
		} catch (e) {
			console.error("gl initialization crash:", e);
		}
		if (!ctx) {
			console.warn("gl initialization failed with opts, trying without opts...");
			ctx = __non_webpack_require__("gl")(width, height);
		}
	}

	const { ThreeJsRenderer } = await import("../viewer/threejsrender.js") as any;
	let render = new ThreeJsRenderer(cnv, { context: ctx, ...opts });
	
	// FIX: Force Three.js to use uniform-based skinning instead of texture-based skinning
	// headless-gl only supports WebGL 1.0, but Three.js attempts to use texelFetch if it thinks
	// float vertex textures are supported, causing shader compilation errors.
	if (!document) {
		render["renderer"].capabilities.floatVertexTextures = false;
	}

	return render;
}

export async function renderAppearance(scene: ThreejsSceneCache, mode: "player" | "appearance" | "item" | "npc" | "loc" | "spot" | "mat" | "map" | "sound" | "music" | "sprite", argument: string, headmodel = false) {
	let width = 500;
	let height = 700;

	// Handle non-3D Assets first
	if (mode == "sound" || mode == "music") {
		const { parseMusic } = await import("../scripts/musictrack.js");
		let major = (mode == "sound" ? cacheMajors.sounds : cacheMajors.music);
		let ogg = await parseMusic(scene.engine.rawsource, major, +argument, null, true);
		return { modelfile: ogg, imgfile: Buffer.alloc(0), metadata: { type: mode, id: argument } };
	}
	if (mode == "sprite") {
		const { parseSprite } = await import("../3d/sprite.js");
		let sprites = await parseSprite(await scene.engine.getFileById(cacheMajors.sprites, +argument));
		let imgfile = await pixelsToImageFile(sprites[0].img as any, "png", 1);
		return { modelfile: imgfile, imgfile, metadata: { type: "sprite", id: argument } };
	}

	const { ThreeJsRenderer, exportThreeJsGltf } = await import("../viewer/threejsrender.js");
	const { RSModel } = await import("../3d/modelnodes.js");
	const { avatarToModel } = await import("../3d/avatar.js");

	let render = await getRenderer(width, height);
	render.addSceneElement({
		getSceneElements() {
			return { options: { autoFrames: "never", hideFloor: true } };
		}
	});

	let meshdata: any;
	if (mode == "player") {
		let url = appearanceUrl(argument);
        let appearance = "";
        try {
		    appearance = await fetch(url).then(q => q.text());
        } catch (e: any) {
            throw new Error(`Avatar service blocked: ${e.message}. Consider using an appearance override string.`);
        }
		if (appearance.indexOf("404 - Page not found") != -1 || appearance.includes("303 See Other") || appearance.includes("Challenge")) { 
            throw new Error("player avatar not found or blocked by Jagex (303/Challenge detected)."); 
        }
		const { avatarToModel } = await import("../3d/avatar.js");
		meshdata = await avatarToModel(scene.engine, avatarStringToBytes(appearance), headmodel);
	} else if (mode == "appearance") {
		const { avatarToModel } = await import("../3d/avatar.js");
		meshdata = await avatarToModel(scene.engine, avatarStringToBytes(argument), headmodel);
	} else if (mode as string == "item") {
		if (isNaN(+argument)) { throw new Error("number expected"); }
		const { itemToModel } = await import("../3d/modelnodes.js");
		meshdata = await itemToModel(scene, +argument);
	} else if (mode as string == "npc") {
		if (isNaN(+argument)) { throw new Error("number expected"); }
		const { npcToModel } = await import("../3d/modelnodes.js");
		meshdata = await npcToModel(scene, { id: +argument, head: headmodel });
	} else if (mode as string == "loc") {
		if (isNaN(+argument)) { throw new Error("number expected"); }
		const { locToModel } = await import("../3d/modelnodes.js");
		meshdata = await locToModel(scene, +argument);
	} else if (mode as string == "spot") {
		if (isNaN(+argument)) { throw new Error("number expected"); }
		const { spotAnimToModel } = await import("../3d/modelnodes.js");
		meshdata = await spotAnimToModel(scene, +argument);
	} else if (mode as string == "mat") {
		if (isNaN(+argument)) { throw new Error("number expected"); }
		const { materialToModel } = await import("../3d/modelnodes.js");
		meshdata = await materialToModel(scene, +argument);
	} else if (mode as string == "map") {
		const { RSMapChunk } = await import("../3d/modelnodes.js");
		let [x, z] = argument.split(",").map(Number);
		let chunk = RSMapChunk.create(scene, x, z);
		render.addSceneElement(chunk);
		// Manual gltf export for map chunk since it's not a standard RSModel
		await delay(100);
		let gltfblob = await exportThreeJsGltf(render.getModelNode());
		return { modelfile: Buffer.from(gltfblob), imgfile: Buffer.alloc(0), metadata: { type: mode, id: argument } };
	} else {
		throw new Error("unknown mode " + mode);
	}

	// Extract Semantic Metadata for NPCs/Items/Objects
	let semantic: any = {};
	try {
		if (mode == "npc") {
			let config: any = parse.npc.read(await scene.engine.getFileById(cacheMajors.npcs, +argument), scene.engine.rawsource);
			console.log("NPC CONFIG CAPTURED:", JSON.stringify(config, null, 2));
			semantic = { 
				name: config.name, 
				actions: [
					config.actions_0, config.actions_1, config.actions_2, config.actions_3, config.actions_4,
					config.members_actions_0, config.members_actions_1, config.members_actions_2, config.members_actions_3, config.members_actions_4
				].filter(Boolean),
				extra: config.extra
			};
		} else if (mode == "item") {
			let config: any = parse.item.read(await scene.engine.getFileById(cacheMajors.items, +argument), scene.engine.rawsource);
			console.log("ITEM CONFIG CAPTURED:", JSON.stringify(config, null, 2));
			semantic = { 
				name: config.name, 
				actions: [
					config.ground_actions_0, config.ground_actions_1, config.ground_actions_2, config.ground_actions_3, config.ground_actions_4,
					config.widget_actions_0, config.widget_actions_1, config.widget_actions_2, config.widget_actions_3, config.widget_actions_4
				].filter(Boolean),
				extra: config.extra
			};
		} else if (mode == "loc") {
			let config: any = parse.object.read(await scene.engine.getFileById(cacheMajors.objects, +argument), scene.engine.rawsource);
			console.log("OBJECT CONFIG CAPTURED:", JSON.stringify(config, null, 2));
			semantic = { 
				name: config.name, 
				actions: [config.actions_0, config.actions_1, config.actions_2, config.actions_3, config.actions_4].filter(Boolean),
				extra: config.extra
			};
		}
	} catch (e) { console.warn("metadata extraction failed:", e); }
	// let player = await itemToModel(scene, 0);
	let model = new RSModel(scene, meshdata.models, meshdata.name);
	if (meshdata.anims && !isNaN(meshdata.anims.default)) {
		model.setAnimation(meshdata.anims.default);
	}
	render.addSceneElement(model);

	console.log("waiting for model to load...");
	await model.model;
	console.log("model loaded. setting camera...");
	await delay(1);
	render.setCameraPosition(new Vector3(0, 0.85, 2.75));
	render.setCameraLimits(new Vector3(0, 0.85, 0));

	console.log("exporting gltf...");
	let gltfblob = await exportThreeJsGltf(render.getModelNode());
	console.log("gltf exported. size:", gltfblob.byteLength);
	let modelfile = Buffer.from(gltfblob);

	console.log("taking picture...");
	let img: { data: Uint8ClampedArray; width: number; height: number };
	try {
		img = await render.takeScenePicture();
		console.log("picture taken. size:", img.data.length);
	} catch (e) {
		console.error("taking picture failed:", e);
		// Return a black dummy image so we don't crash the pedagogy loop
		img = new (globalThis as any).ImageData(new Uint8ClampedArray(width * height * 4), width, height);
	}
	let imgfile = await pixelsToImageFile(img as any, "png", 1);
	console.log("image compressed. size:", imgfile.length);

	try {
		render.dispose();
	} catch (e) {
		// Silently ignore headless dispose errors.
	}

	return { imgfile, modelfile, semantic };
}
