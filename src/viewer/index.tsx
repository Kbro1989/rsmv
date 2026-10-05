
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import * as datastore from "idb-keyval";
import { ModelBrowser, RendererControls } from "./scenenodes";
import { useEmitterProperty, useForceUpdate } from "./commoncontrols";
import { BrowsePageId, UIContext, SavedCacheSource, CacheSelector, UIOpenedFile, UIRootContext, UIEngineContext, downloadBlob } from "./maincomponents";
import { BrowseDisplay } from "./tabs/browse";
import { FileDisplay } from "./viewers/fileviewer";
import classNames from "classnames";
import { exposeDebugToolsInGlobal } from "../consoletools";
import { BlobTS } from "../utils";


exposeDebugToolsInGlobal();


export function unload(app: { root: ReactDOM.Root, ctx: UIContext }) {
	app.root.unmount();
	app.ctx.close();
}

export function start(rootelement: HTMLElement, skipnavigationapi?: boolean) {
	window.addEventListener("keydown", e => {
		if (e.key == "F5") { document.location.reload(); }
		// if (e.key == "F12") { electron.remote.getCurrentWebContents().toggleDevTools(); }
	});

	let ctx = new UIContext(rootelement, !!skipnavigationapi);
	let root = ReactDOM.createRoot(rootelement);
	(globalThis as any).rsmvuicontext = ctx;
	root.render(
		<UIRootContext.Provider value={ctx}>
			<App />
		</UIRootContext.Provider>
	);

	return { root, ctx };
}


function App(p: {}) {
	let ctx = React.useContext(UIRootContext);
	let splitview = useEmitterProperty(ctx, "preferencesChanged", () => ctx.preferences.splitview);

	let openCache = ctx.openCache;
	let closeCache = ctx.closeCache;

	React.useEffect(() => {
		(async () => {
			try {
				let c = await Promise.race([
					datastore.get<SavedCacheSource>("openedcache"),
					new Promise<never>((d, f) => setTimeout(f, 1000))
				]);
				if (c) { openCache(c); }
			} catch (e) {
				console.log("failed to open indexedDB openedcache, fallback to localStorage (without webfs support)");
				try {
					let cache = JSON.parse(localStorage.rsmv_openedcache!);
					openCache(cache);
				} catch (e) { }
			};
		})()
	}, []);

	let redraw = useForceUpdate();
	React.useEffect(() => {
		let resize = () => {
			redraw();
			ctx.renderer?.forceFrame();
		}
		ctx.on("statechange", redraw);
		ctx.on("showTab", redraw);
		window.addEventListener("resize", resize);
		return () => {
			ctx.off("statechange", redraw);
			ctx.off("showTab", redraw);
			window.removeEventListener("resize", resize);
		}
	}, [ctx]);

	let width = ctx.rootElement.clientWidth;
	let vertical = width < 550;

	let cachemeta = ctx.source?.getCacheMeta();
	return (
		<UIEngineContext.Provider value={ctx.renderable}>
			<div className={classNames("mv-root", "mv-style", { "mv-root--vertical": vertical })}>
				<div style={{ display: "flex", flexDirection: "column" }}>
					{(!ctx.visibleTab || splitview) && <MainCanvas />}
					{ctx.visibleTab && <ModalTabViewer />}
				</div>
				<div className="mv-sidebar">
					{!ctx.source && (
						<React.Fragment>
							<CacheSelector onOpen={openCache} />
							<div style={{ flex: "1" }} />
							<div style={{ textAlign: "center" }}>
								Go to <a href="https://runeapps.org/modelviewer_about">RuneApps</a> for more info. Source code hosted at <a href="https://github.com/skillbert/rsmv" target="_blank">github.com/skillbert/rsmv</a>
							</div>
						</React.Fragment>
					)}
					{cachemeta && (
						<React.Fragment>
							<input type="button" className="sub-btn" onClick={closeCache} value={`Close ${cachemeta.name}`} title={cachemeta.descr} />
							<RendererControls />
							<ModelBrowser />
						</React.Fragment>
					)}
				</div>
			</div >
		</UIEngineContext.Provider>
	);
}

function MainCanvas() {
	let ctx = React.useContext(UIRootContext);
	let ref = React.useCallback((element: HTMLDivElement | null) => {
		if (element && ctx.renderer) {
			element.appendChild(ctx.renderer.canvas);
			ctx.renderer.forceFrame();
		}
	}, [ctx.renderer]);
	return <div ref={ref} className="mv-canvas" style={{ flex: "1" }} />;
}

export function FileTabStrip() {
	let ctx = React.useContext(UIRootContext);
	let splitview = useEmitterProperty(ctx, "preferencesChanged", () => ctx.preferences.splitview);

	return (
		<div className="mv-tabbed-head">
			{ctx.openedTabs.map((tab, index) => (
				<div key={index} className={classNames("mv-tabbed-tab", { "mv-tabbed-tab--active": ctx.visibleTab === tab })} onClick={() => ctx.openFile(tab)} onAuxClick={() => ctx.closeFile(tab)}>
					{tab.type == "browse" && tab.id}
					{tab.type == "view3d" && tab.id}
					{tab.type == "file" && tab.name}
					<span className="mv-closebutton" style={{ marginLeft: "10px" }} onClick={e => { ctx.closeFile(tab); e.stopPropagation(); }}></span>
				</div>
			))}
			<div className="mv-tabbed-btn" onClick={() => ctx.setPreferences({ splitview: !splitview })}>{splitview ? "Split: Enabled" : "Split: Disabled"}</div>
		</div>
	);
}

export function ModalTabViewer() {
	let ctx = React.useContext(UIRootContext);

	return (
		<div style={{ flex: "1", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
			<FileTabStrip />
			<div style={{ overflow: "auto", flex: "1", position: "relative" }}>
				{ctx.openedTabs.map((tab, index) => {
					let child: React.ReactElement | null = null;
					let key = "" + index;
					if (tab.type == "file") { key = tab.name; child = <FileDisplay file={tab} />; }
					if (tab.type == "browse") { key = tab.id; child = <BrowseDisplay browse={tab} />; }
					return <div key={key} style={{ display: ctx.visibleTab === tab ? "contents" : "none" }}>{child}</div>;
				})}
			</div>
		</div>
	);
}

export function FileViewer(p: { file: UIOpenedFile, onSelectFile: (file: UIOpenedFile | null) => void }) {
	return (
		<div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
			<div className="mv-modal-head">
				<span>{p.file.name}</span>
				<span style={{ float: "right", marginLeft: "10px" }} onClick={() => downloadBlob(p.file.name, new BlobTS([p.file.data]))}>download</span>
				<span className="mv-closebutton" style={{ float: "right", marginLeft: "10px" }} onClick={() => p.onSelectFile(null)}></span>
			</div>
			<div style={{ overflow: "auto", flex: "1", position: "relative" }}><FileDisplay file={p.file} /></div>
		</div>
	);
}

export function BrowseViewer(p: { browse: BrowsePageId, onSelectFile: (file: UIOpenedFile | null) => void }) {
	return (
		<div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
			<div className="mv-modal-head">
				<span>{p.browse.id}</span>
				<span className="mv-closebutton" style={{ float: "right", marginLeft: "10px" }} onClick={() => p.onSelectFile(null)}></span>
			</div>
			<div style={{ overflow: "auto", flex: "1", position: "relative" }}><BrowseDisplay browse={p.browse} /></div>
		</div>
	);
}
