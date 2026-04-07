import { SovereignEngine } from "./RSEngine";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import * as datastore from "idb-keyval";
import { EngineCache, ThreejsSceneCache } from "../3d/modeltothree";
import { ModelBrowser, RendererControls } from "./scenenodes";

import { UIScriptFile, UIScriptFS } from "./scriptsui";
import { UIContext, SavedCacheSource, FileViewer, CacheSelector, openSavedCache, UIOpenedFile } from "./maincomponents";
import classNames from "classnames";
import { cliApi, CliApiContext } from "../clicommands";
import { CLIScriptOutput } from "../scriptrunner";
import { ThreeJsRenderer } from "./threejsrender";
import * as cmdts from "cmd-ts";
import { SovereignHUD } from "./SovereignHUD";
import { SovereignBridge } from "./SovereignBridge";

export function unload(root: ReactDOM.Root) {
	root.unmount();
}

export function start(rootelement: HTMLElement, serviceworker?: boolean) {
	window.addEventListener("keydown", e => {
		if (e.key == "F5") { document.location.reload(); }
	});

	let ctx = new UIContext(rootelement, serviceworker ?? false);
	
	// 0. Initialize real-time bridge to POG2 backend
	SovereignBridge.getInstance();
	
	// 1. Mount React as the single root authority
	let root = ReactDOM.createRoot(rootelement);
	root.render(<App ctx={ctx} />);

	globalThis.cli = async (args: string) => {
		let cliconsole = new CLIScriptOutput();
		let outputs: Record<string, any> = {};

		let clictx: CliApiContext = {
			getConsole() { return cliconsole; },
			getFs(name: string) { return outputs[name] ??= new UIScriptFS(null); },
			getDefaultCache() { return ctx.source!; }
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

	return root;
}

class App extends React.Component<{ ctx: UIContext }, { openedFile: UIOpenedFile | null }> {
	canvasRef = React.createRef<HTMLCanvasElement>();

	constructor(p: { ctx: UIContext }) {
		super(p);
		this.state = {
			openedFile: this.props.ctx.openedfile
		};
		(async () => {
			try {
				let c = await Promise.race([
					datastore.get<SavedCacheSource>("openedcache"),
					new Promise<never>((d, f) => setTimeout(f, 1000))
				]);
				if (c) { this.openCache(c); }
			} catch (e) {
				console.log("failed to open indexedDB openedcache, fallback to localStorage (without webfs support)");
				try {
					let cache = JSON.parse(localStorage.rsmv_openedcache!);
					this.openCache(cache);
				} catch (e) { }
			};
		})();
	}

	openCache = async (source: SavedCacheSource) => {
		let cache = await openSavedCache(source, true);
		if (cache) {
			globalThis.source = cache;
			this.props.ctx.setCacheSource(cache);

			try {
				let engine = await EngineCache.create(cache);
				console.log("engine loaded", cache.getBuildNr());
				let scene = await ThreejsSceneCache.create(engine);
				this.props.ctx.setSceneCache(scene);
				
				// Initialize RSEngine cache context
				SovereignEngine.setCache(scene);

				// Initialize Sovereign Grounding (Pedagogy)
				try {
					const { SovereignGrounding } = await import("../map/grounding_logic");
					
					// We load from the local disk if in Electron/Node environment
					if (typeof require !== "undefined") {
						const grounding = await SovereignGrounding.loadDefault();
						this.props.ctx.setGrounding(grounding);
						SovereignEngine.setGrounding(grounding); // Feed it to the interactive engine hook
						console.log("Sovereign Grounding Integrated (Full Pedagogy Hydration)");
					}
				} catch (e) {
					console.warn("Could not load Sovereign Grounding data", e);
				}

				globalThis.sceneCache = scene;
				globalThis.engine = engine;
			} catch (e) {
				console.log("failed to create scenecache");
				console.error(e);
			}
		};
	}

	initCnv = (cnv: HTMLCanvasElement | null) => {
		// Guard: only set a new renderer if the canvas element actually changed
		// Otherwise setRenderer emits statechange → forceUpdate → re-render → initCnv → infinite loop
		const currentCanvas = this.props.ctx.renderer?.getCanvas?.() ?? null;
		if (cnv === currentCanvas) return;
		if (!cnv && !this.props.ctx.renderer) return;
		this.props.ctx.setRenderer(cnv ? new ThreeJsRenderer(cnv) : null);
	}

	handleCanvasRef = (el: HTMLCanvasElement | null) => {
		(this.canvasRef as any).current = el;
		this.initCnv(el);
	}

	closeCache = () => {
		datastore.del("openedcache");
		localStorage.rsmv_openedcache = "";
		navigator.serviceWorker?.ready.then(q => q.active?.postMessage({ type: "sethandle", handle: null }));
		this.props.ctx.source?.close();
		this.props.ctx.setCacheSource(null);
		this.props.ctx.setSceneCache(null);
	}

	stateChanged = () => {
		this.forceUpdate();
	}

	resized = () => {
		this.forceUpdate();
	}

	componentDidMount() {
		this.props.ctx.on("openfile", this.openFile);
		this.props.ctx.on("statechange", this.stateChanged);
		window.addEventListener("resize", this.resized);

		// Initialize Sovereign Engine on the React-owned canvas
		if (this.canvasRef.current) {
			SovereignEngine.initialize(this.canvasRef.current, {
				initialPosition: { x: 3712, y: 3328, z: 0 }, // Havenhythe
				avatarEntityId: 1556,
				cacheSource: 'D:\\sovereign\\cache_pedagogy'
			});
		}
	}

	componentWillUnmount() {
		this.props.ctx.off("openfile", this.openFile);
		this.props.ctx.off("statechange", this.stateChanged);
		window.removeEventListener("resize", this.resized);
		this.closeCache();
	}

	openFile = (file: UIOpenedFile | null) => {
		this.setState({ openedFile: file });
	}

	render() {
		let width = this.props.ctx.rootElement.clientWidth;
		let vertical = width < 550;

		let cachemeta = this.props.ctx.source?.getCacheMeta();
		return (
			<div className={classNames("mv-root", "mv-style", { "mv-root--vertical": vertical })} 
				style={{ 
					display: 'flex', 
					width: '100vw', 
					height: '100vh', 
					overflow: 'hidden',
					background: '#000'
				}}>
				
				{/* 3D World Section (Left/Top) */}
				<div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
					{/* 2026 Sovereign HUD Overlay (Transparent siblings) */}
					<SovereignHUD />
					
					<canvas 
						id="pog2-world"
						className="mv-canvas" 
						ref={this.handleCanvasRef} 
						style={{ 
							display: this.state.openedFile ? "none" : "block", 
							width: '100%', 
							height: '100%',
							pointerEvents: 'auto' 
						}}
					/>
					
					{this.state.openedFile && (
						<div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: '#222', zIndex: 10, pointerEvents: 'auto' }}>
							<FileViewer file={this.state.openedFile} onSelectFile={this.props.ctx.openFile} />
						</div>
					)}
				</div>

				{/* Sidebar Section (Right/Bottom) */}
				<div 
					className="mv-sidebar" 
					style={{ 
						width: vertical ? '100%' : '320px', 
						height: vertical ? '40%' : '100%',
						pointerEvents: 'auto', 
						borderLeft: '1px solid #445',
						zIndex: 20
					}}>
					{!this.props.ctx.source && (
						<React.Fragment>
							<CacheSelector onOpen={this.openCache} />
							<div style={{ flex: "1" }} />
							<div style={{ textAlign: "center", padding: "15px", background: "rgba(0,0,0,0.5)", borderRadius: "6px", margin: "10px" }}>
								<h3 style={{ margin: "0 0 10px 0", color: "#4caf50" }}>POG2 Sovereign Engine</h3>
								<div style={{ textAlign: "left", fontSize: "13px", color: "#ccc", marginBottom: "12px", lineHeight: "1.6" }}>
									<b>System Status:</b>
									<ul style={{ margin: "4px 0 0 15px", padding: 0 }}>
										<li>✅ Spatial Grounding Synthesized (Prif/Havenhythe)</li>
										<li>✅ Full Terrain Rendering Pipeline Restored</li>
										<li>✅ Deobfuscated CS2 Logic & Enum Chains</li>
										<li>✅ 100% Skill Taxonomies Mapped</li>
									</ul>
								</div>
								<div style={{ fontSize: "11px", color: "#888", borderTop: "1px solid #444", paddingTop: "10px" }}>
									Built on <a href="https://runeapps.org/modelviewer_about" style={{color:"#888"}}>RuneApps</a> | Code at <a href="https://github.com/Kbro1989/POG2" target="_blank" style={{color:"#888"}}>Kbro1989/POG2</a>
								</div>
							</div>
						</React.Fragment>
					)}
					{cachemeta && (
						<React.Fragment>
							<input type="button" className="sub-btn" onClick={this.closeCache} value={`Close ${cachemeta.name}`} title={cachemeta.descr} />
							<RendererControls ctx={this.props.ctx} />
							<ModelBrowser ctx={this.props.ctx} />
						</React.Fragment>
					)}
				</div>
			</div >
		);
	}
}