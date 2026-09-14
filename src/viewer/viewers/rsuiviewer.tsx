import * as React from "react";
import { MAGIC_CONST_CURRENTCOMP, MAGIC_CONST_IF_AS_CC, MAGIC_CONST_MOUSE_X, MAGIC_CONST_MOUSE_Y, MAGIC_CONST_OPNR, MAGIC_CONST_MOUSE_DRAG_ICON, RsInterfaceComponent, RsInterfaceDomTree, UiRenderContext, componentTypeNames, loadRsInterfaceData, renderRsInterfaceDOM } from "../../scripts/renderrsinterface";
import { DomWrap, useAwaited, useEmitterProperty } from "../commoncontrols";
import { packComponent, unpackComponent } from "../../utils";
import { UIEngineContext, UIRootContext } from "../maincomponents";
import { ClientScriptDeobLoader } from "../../clientscript";
import { internalNameFiles, vartypeReverseMap } from "../../constants";
import { clientScriptDeobPopup, makeFileId } from "../tabs/browse";
import { packedIntToLogical, traverseJsonSchema, vartypeToDecoder } from "../../scripts/jsonindexer";
import { ObjectLink, ReferencesView, renderPrimitive, StructDataView, StructView } from "./configview";
import { parse } from "../../parser/jsondecoders";

export function RsUIViewer(p: { interfaceid: number, subcomponent?: number }) {
	let rootctx = React.useContext(UIRootContext);
	let rendercontext = React.useContext(UIEngineContext);
	let [ui, setui] = React.useState<RsInterfaceDomTree | null>(null);
	let [refreshcount, refresh] = React.useReducer((v: number) => v + 1, 0);
	let [explicitscript, setExplicitscript] = React.useState(false);

	let wantsscripts = useEmitterProperty(rootctx, "preferencesChanged", e => rootctx.preferences.runinterfacescripts);
	let deobloader = rootctx.source && ClientScriptDeobLoader.forCache(rootctx.source);

	let ctx = React.useMemo(() => {
		if (!rendercontext) { throw new Error("UIEngineContext is not available"); }
		let res = new UiRenderContext(rendercontext.sceneCache.engine);
		res.sceneCache = rendercontext.sceneCache;
		res.renderer = rendercontext.renderer;
		return res;
	}, [rendercontext]);

	let deob = useAwaited(() => {
		if (!wantsscripts || !deobloader || !rootctx.source) { return null; }
		// synchronous fastpath
		if (deobloader.loaded) { return deobloader.loaded; }
		return (async () => {
			if (explicitscript) {
				// only show the generate popup if use explicitly clicked load scripts (not when still on from earlier use)
				await clientScriptDeobPopup(ctx.source);
			} else {
				await deobloader.tryLoadStored(rootctx.source!);
			}
			return deobloader.loaded;
		})();
	}, [wantsscripts, deobloader, rootctx.source, explicitscript])

	React.useEffect(() => {
		let needed = true;
		let prom = loadRsInterfaceData(ctx, p.interfaceid);
		let rsui = prom.then(ui => {
			if (!needed) { return; }
			ctx.scriptdeob = (wantsscripts ? deob ?? null : null);
			let res = renderRsInterfaceDOM(ctx, ui);
			setui(res);
			return res;
		});
		return () => {
			needed = false;
			rsui.then(res => {
				res?.dispose();
			});
		};
	}, [ctx, p.interfaceid, refreshcount, deob]);

	React.useEffect(() => {
		if (p.subcomponent !== undefined && ui?.interfaceid == p.interfaceid) {
			ctx.toggleHighLightComp(packComponent(p.interfaceid, p.subcomponent), true);
		}
	}, [p.subcomponent, ctx, ui]);

	let scrollfix = React.useCallback((el: HTMLElement | null) => {
		if (!el || !ui) { return; }

		let expandbounds = (el: Element, bounds: { x1: number, x2: number, y1: number, y2: number }) => {
			let box = el.getBoundingClientRect();
			bounds.x1 = Math.min(bounds.x1, box.left);
			bounds.x2 = Math.max(bounds.x2, box.right);
			bounds.y1 = Math.min(bounds.y1, box.top);
			bounds.y2 = Math.max(bounds.y2, box.bottom);
			for (let child of Array.from(el.children)) {
				expandbounds(child, bounds);
			}
		}

		let bounds = { x1: 0, x2: 0, y1: 0, y2: 0 };
		expandbounds(ui.el, bounds);
		let ownbounds = el.getBoundingClientRect();
		let negx = Math.round(ownbounds.left - bounds.x1);
		let negy = Math.round(ownbounds.top - bounds.y1);

		ui.container.style.left = `${negx}px`;
		ui.container.style.top = `${negy}px`;

		el.scrollLeft = negx;
		el.scrollTop = negy;
	}, [ui]);

	let mouseevent = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
		let comp: RsInterfaceComponent | null = null;
		let target = e.target as HTMLElement | null;
		while (target && target != ui?.el) {
			let compid = (target as any).compid;
			if (typeof compid == "number") {
				comp = ctx.comps.get(compid) ?? null;
				break;
			}
			target = target.parentElement;
		}
		if (e.type == "mouseout") {
			ctx.emit("hover", null);
		} else if (e.type == "mouseover") {
			ctx.emit("hover", comp);
		} else if (e.type == "click") {
			ctx.emit("select", comp);
		}
	}, [ctx, ui]);

	let toggleOnloadScripts = (e: React.ChangeEvent<HTMLInputElement>) => {
		let checked = e.currentTarget.checked;
		rootctx.setPreferences({ runinterfacescripts: checked });
		setExplicitscript(checked);
	}

	return (
		<div style={{ position: "absolute", inset: "0px", display: "grid", gridTemplate: '"a" 1fr "b" auto "c" 1fr / 1fr' }}>
			<div style={{ position: "relative", overflow: "auto" }} ref={scrollfix} onMouseOver={mouseevent} onMouseOut={mouseevent} onClick={mouseevent}>
				<DomWrap el={ui?.el} />
			</div>
			<div>
				<input type="button" className="sub-btn" onClick={refresh} value="reload" />
				<label>
					<input type="checkbox" checked={rootctx.preferences.runinterfacescripts} onChange={toggleOnloadScripts} />
					Run load scripts
				</label>
			</div>
			<div style={{ overflowY: "auto" }}>
				{ui?.rootcomps.map((q, i) => <RsInterfaceDebugger ctx={ctx} key={i} comp={q} />)}
			</div>
		</div>
	)
}

function RsInterfaceDebugger(p: { ctx: UiRenderContext, comp: RsInterfaceComponent }) {
	let data = p.comp.data;
	let [selected, setselected] = React.useState(false);
	let [hovered, sethovered] = React.useState(false);
	let rootctx = React.useContext(UIRootContext);
	let id = unpackComponent(p.comp.compid);

	let mouseevent = React.useCallback((e: React.MouseEvent) => {
		p.ctx.toggleHighLightComp(p.comp.compid, e.type == "mouseenter");
	}, [p.ctx, p.comp]);

	React.useEffect(() => {
		let hover = (e: RsInterfaceComponent | null) => sethovered(e == p.comp)
		let click = (e: RsInterfaceComponent | null) => setselected(e == p.comp);
		p.ctx.on("hover", hover);
		p.ctx.on("select", click);
		return () => {
			p.ctx.off("hover", hover);
			p.ctx.off("select", click);
		}
	}, [p.ctx, p.comp])

	let ref = React.useCallback((el: HTMLElement | null) => {
		if (el && selected) { el.scrollIntoView(); }
	}, [selected]);

	let name = useAwaited(async () => {
		let fullname = await rootctx.source?.getInternalName(internalNameFiles.component, p.comp.compid) ?? "";
		return fullname.split("__")[1];
	}, [p.comp.compid, rootctx.source]);

	let typetext = componentTypeNames[data.type] ?? `type_${data.type}`;

	return (
		<div className={"rs-componentmeta" + (selected || hovered ? " rs-componentmeta--active" : "")} ref={ref} onMouseEnter={mouseevent} onMouseLeave={mouseevent} onClick={e => e.target == e.currentTarget && console.log(p.comp)}>
			id={id.sub} ({typetext}) - {name}
			<br />
			{data.textdata && (
				<div>{data.textdata.text}</div>
			)}
			{data.spritedata && <ObjectLink rsmvtype="graphic" value={data.spritedata.spriteid} />}
			{data.modeldata && <ObjectLink rsmvtype="model" value={data.modeldata.modelid} />}
			<CallbackDebugger ctx={p.ctx} comp={p.comp} />
			<ReferencesView browsemode="components" id={[id.intf, id.sub]} />
			<hr />
			<div className="rs-componentmeta-children">
				{p.comp.children.map((q, i) => <RsInterfaceDebugger ctx={p.ctx} key={i} comp={q} />)}
			</div>
		</div>
	)
}

const intMagicMap = new Map<number, string>([
	[MAGIC_CONST_MOUSE_X, "MOUSE_X"],
	[MAGIC_CONST_MOUSE_Y, "MOUSE_Y"],
	[MAGIC_CONST_CURRENTCOMP, "CURRENTCOMP"],
	[MAGIC_CONST_OPNR, "OPNR"],
	[MAGIC_CONST_IF_AS_CC, "IF_AS_CC"],
	[MAGIC_CONST_MOUSE_DRAG_ICON, "MOUSE_DRAG_ICON"],
]);

const componentschema = parse.components.parser.getJsonSchema();


function CallbackDebugger(p: { ctx: UiRenderContext, comp: RsInterfaceComponent }) {
	let ctx = React.useContext(UIRootContext);
	let deob = ctx.source && ClientScriptDeobLoader.forCache(ctx.source).loaded;
	let preventmiddledrag = (e: React.MouseEvent) => { e.button == 1 && e.preventDefault(); };
	return (
		<div>
			{Object.entries(p.comp.data.scripts).filter(q => q[1] && q[1].length != 0).map(([key, v]) => {
				if (!v) { throw new Error("unexpected"); }
				if (typeof v[0] != "number") { throw new Error("unexpected") }
				let callbackid = v[0];
				let callbackargs: React.ReactNode[] = [];
				let intcount = 0;
				let stackin = deob?.scriptargs.get(callbackid)?.stack.exactin;
				for (let i = 1; i < v.length; i++) {
					let arg = v[i];
					if (callbackargs.length != 0) { callbackargs.push(", "); }
					if (typeof arg == "number") {
						let magicmatch = intMagicMap.get(arg);
						if (magicmatch) {
							callbackargs.push(<span key={i} className="mv-code__opname">{magicmatch}</span>);
						} else {
							let argtype = stackin?.int[intcount];
							let typename = argtype != undefined && vartypeReverseMap.get(argtype) || "unknown" as const;
							let browsemode = typename && vartypeToDecoder[typename];
							if (browsemode) {
								let index = packedIntToLogical(arg, typename);
								let fileid = makeFileId(typename, index);
								callbackargs.push(<span key={i} className="mv-code__link mv-code__global" data-objectid={fileid} onClick={ctx.objectClick} onAuxClick={ctx.objectClick} onMouseDown={preventmiddledrag}>{fileid}</span>)
							} else {
								callbackargs.push(<span key={i} className="mv-code__literalint">{arg}</span>);
							}
						}
						intcount++;
					} else if (typeof arg == "string") {
						callbackargs.push(<span key={i} className="mv-code__literalstring">"{arg}"</span>);
					}
				}
				return (
					<div key={key}>
						<span onClick={e => deob && p.ctx.runClientScriptCallback(deob, p.comp.compid, v)}>{key}</span>:
						<span className="mv-codeview" style={{ background: "#0004" }}>
							<span className="mv-code__link mv-code__scriptname" data-objectid={`clientscript_${callbackid}`} onClick={ctx.objectClick} onAuxClick={ctx.objectClick} onMouseDown={preventmiddledrag}>
								script_{callbackid}
							</span>
							({callbackargs})
						</span>
					</div>
				)
			})}
			{Object.entries(p.comp.data.scriptdata).filter(q => q[1] && q[1].length != 0).map(([key, v]) => {
				let schema = traverseJsonSchema(traverseJsonSchema(componentschema, "scriptdata"), key);

				return <div key={key}>
					<span>{key}:</span>
					<span className="mv-codeview" style={{ background: "#0004" }}>
						<StructDataView data={v} meta={schema} />
					</span>
				</div>
			})}
		</div>
	)
}