
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { ModelBrowser, RendererControls } from "./scenenodes";
import { UIContext, CacheSelector, UIOpenedFile, UIRootContext, UIEngineContext, downloadBlob, BrowsePageId } from "./maincomponents";
import classNames from "classnames";
import { exposeDebugToolsInGlobal } from "../consoletools";
import { DomWrap, useEmitterProperty, useForceUpdate } from "./commoncontrols";
import { FileDisplay } from "./viewers/fileviewer";
import { BrowseDisplay } from "./tabs/browse";
import { BlobTS } from "../utils";
import * as electron from "electron/renderer";

exposeDebugToolsInGlobal();

export function unload(obj: { root: ReactDOM.Root, ctx: UIContext }) {
	obj.root.unmount();
	obj.ctx.close();
	globalThis.uicontext = null;
}

export function start(rootelement: HTMLElement, serviceworker?: boolean) {
	if (electron.ipcRenderer) {
		// electron doesn't bind these
		window.addEventListener("keydown", e => {
			if (e.altKey && e.key == "ArrowLeft") { navigation.back(); }
			if (e.altKey && e.key == "ArrowRight") { navigation.forward(); }
			if (e.key == "F5") { navigation.reload(); }
			if (e.key == "F12") { electron.ipcRenderer.invoke("toggledevtools"); }
		});
	}

	let ctx = new UIContext(rootelement, serviceworker ?? false);
	let root = ReactDOM.createRoot(rootelement);
	root.render(
		<UIRootContext.Provider value={ctx}>
			<App />
		</UIRootContext.Provider>
	);

	globalThis.uicontext = ctx;
	return { root, ctx };
}


function App(p: {}) {
	let ctx = React.useContext(UIRootContext);
	let splitview = useEmitterProperty(ctx, "preferencesChanged", e => ctx.preferences.splitview);

	let redraw = useForceUpdate();
	React.useEffect(() => {
		let resize = () => {
			redraw();
			ctx.renderer.forceFrame();
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
							<CacheSelector onOpen={ctx.openCache} />
							<div style={{ flex: "1" }} />
							<div style={{ textAlign: "center" }}>
								Go to <a href="https://runeapps.org/modelviewer_about">RuneApps</a> for more info. Source code hosted at <a href="https://github.com/skillbert/rsmv" target="_blank">github.com/skillbert/rsmv</a>
							</div>
						</React.Fragment>
					)}
					{cachemeta && (
						<React.Fragment>
							<input type="button" className="sub-btn" onClick={ctx.closeCache} value={`Close ${cachemeta.name}`} title={cachemeta.descr} />
							<RendererControls />
							<ModelBrowser />
						</React.Fragment>
					)}
				</div>
			</div>
		</UIEngineContext.Provider>
	);
}

function MainCanvas(p: {}) {
	let ctx = React.useContext(UIRootContext);
	let ref = React.useCallback((el: HTMLDivElement | null) => {
		if (el) {
			el.appendChild(ctx.renderer.canvas);
			ctx.renderer.forceFrame();
		}
	}, [ctx.renderer]);
	let center = React.useCallback(() => {
		ctx.renderer.setCameraLimits();
	}, [ctx.renderer]);
	return <div ref={ref} className="mv-canvas" style={{ flex: "1" }} >
		<div className="mv-canvasbuttons">
			{/* <div className="mv-canvasbutton" onClick={center}>center</div> */}
		</div>
	</div>
}

export function FileTabStrip() {
	let ctx = React.useContext(UIRootContext);
	let splitview = useEmitterProperty(ctx, "preferencesChanged", e => ctx.preferences.splitview);

	return (
		<div className="mv-tabbed-head">
			{ctx.openedTabs.map((tab, index) => (
				<div key={index} className={classNames("mv-tabbed-tab", { "mv-tabbed-tab--active": ctx.visibleTab === tab })} onClick={() => ctx.openFile(tab)} onAuxClick={() => ctx.closeFile(tab)}>
					{tab.type == "browse" && tab.id}
					{tab.type == "view3d" && tab.id}
					{tab.type == "file" && tab.name}
					<span style={{ marginLeft: "10px" }} onClick={e => { ctx.closeFile(tab); e.stopPropagation(); }}>x</span>
				</div>
			))}
			<div className="mv-tabbed-btn" onClick={e => ctx.setPreferences({ splitview: !splitview })}>{splitview ? "Split: Enabled" : "Split: Disabled"}</div>
		</div>
	)
}

export function ModalTabViewer() {
	let ctx = React.useContext(UIRootContext);

	return (
		<div style={{ flex: "1", display: "grid", gridTemplateRows: "auto 1fr", overflow: "hidden" }}>
			<FileTabStrip />
			<div style={{ overflow: "auto", flex: "1", position: "relative" }}>
				{ctx.openedTabs.map((tab, i) => {
					let child: React.ReactElement | null = null;
					let key = "" + i;//TODO this key is weak, need proper uuid system
					if (tab.type == "file") { key = tab.name; child = <FileDisplay file={tab} />; }
					if (tab.type == "browse") { key = tab.id; child = <BrowseDisplay browse={tab} />; }
					return <div key={key} style={{ display: ctx.visibleTab === tab ? "contents" : "none" }}>
						{child}
					</div>;
				})}
			</div>
		</div>
	);
}

export function FileViewer(p: { file: UIOpenedFile, onSelectFile: (f: UIOpenedFile | null) => void }) {
	return (
		<div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
			<div className="mv-modal-head">
				<span>{p.file.name}</span>
				<span style={{ float: "right", marginLeft: "10px" }} onClick={e => downloadBlob(p.file.name, new BlobTS([p.file.data]))}>download</span>
				<span style={{ float: "right", marginLeft: "10px" }} onClick={e => p.onSelectFile(null)}>x</span>
			</div>
			<div style={{ overflow: "auto", flex: "1", position: "relative" }}>
				<FileDisplay file={p.file} />
			</div>
		</div>
	);
}


export function BrowseViewer(p: { browse: BrowsePageId, onSelectFile: (f: UIOpenedFile | null) => void }) {
	return (
		<div style={{ display: "grid", gridTemplateRows: "auto 1fr" }}>
			<div className="mv-modal-head">
				<span>{p.browse.id}</span>
				<span style={{ float: "right", marginLeft: "10px" }} onClick={e => p.onSelectFile(null)}>x</span>
			</div>
			<div style={{ overflow: "auto", flex: "1", position: "relative" }}>
				<BrowseDisplay browse={p.browse} />
			</div>
		</div>
	);
}

