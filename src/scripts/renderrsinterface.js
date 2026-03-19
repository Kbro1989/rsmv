"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CS2Api = exports.RsInterfaceComponent = exports.UiRenderContext = exports.MAGIC_UNK06 = exports.MAGIC_CONST_IF_AS_CC = exports.MAGIC_CONST_OPNR = exports.MAGIC_CONST_CURRENTCOMP = exports.MAGIC_CONST_MOUSE_Y = exports.MAGIC_CONST_MOUSE_X = void 0;
exports.loadRsInterfaceData = loadRsInterfaceData;
exports.renderRsInterfaceHTML = renderRsInterfaceHTML;
exports.renderRsInterfaceDOM = renderRsInterfaceDOM;
const modelnodes_1 = require("../3d/modelnodes");
const sprite_1 = require("../3d/sprite");
const clientscript_1 = require("../clientscript");
const interpreter_1 = require("../clientscript/interpreter");
const constants_1 = require("../constants");
const imgutils_1 = require("../imgutils");
const opdecoder_1 = require("../opdecoder");
const utils_1 = require("../utils");
exports.MAGIC_CONST_MOUSE_X = 0x80000001 | 0;
exports.MAGIC_CONST_MOUSE_Y = 0x80000002 | 0;
exports.MAGIC_CONST_CURRENTCOMP = 0x80000003 | 0;
exports.MAGIC_CONST_OPNR = 0x80000004 | 0;
exports.MAGIC_CONST_IF_AS_CC = 0x80000005 | 0;
exports.MAGIC_UNK06 = 0x80000006 | 0;
class UiRenderContext extends utils_1.TypedEmitter {
    source;
    sceneCache = null;
    renderer = null;
    comps = new Map();
    highlightstack = [];
    interpreterprom = null;
    touchedComps = new Set();
    runOnloadScripts = false;
    constructor(source) {
        super();
        this.source = source;
    }
    toggleHighLightComp(subid, highlight) {
        let comp = this.comps.get(subid)?.element;
        if (comp) {
            if (highlight) {
                if (this.highlightstack.length != 0) {
                    this.highlightstack.at(-1).classList.remove("rs-component--highlight");
                }
                comp.classList.add("rs-component--highlight");
                this.highlightstack.push(comp);
            }
            else {
                comp.classList.remove("rs-component--highlight");
                if (this.highlightstack.pop() != comp) {
                    console.log("wrong unlightlight order");
                }
                if (this.highlightstack.length != 0) {
                    this.highlightstack.at(-1).classList.add("rs-component--highlight");
                }
            }
        }
    }
    async runClientScriptCallback(compid, cbdata) {
        if (cbdata.length == 0) {
            return;
        }
        let inter = await (this.interpreterprom ??= (0, clientscript_1.prepareClientScript)(this.source).then(q => new interpreter_1.ClientScriptInterpreter(q, this)));
        if (typeof cbdata[0] != "number") {
            throw new Error("expected callback script id but got string");
        }
        inter.reset(); //TODO warn if this actually does anything?
        inter.pushlist(cbdata.slice(1));
        inter.activecompid = compid;
        await inter.callscriptid(cbdata[0]);
        await inter.runToEnd();
        this.updateInvalidatedComps();
        // console.log(await renderClientScript(p.source, await p.source.getFileById(cacheMajors.clientscript, callbackid), callbackid))
    }
    updateInvalidatedComps() {
        this.touchedComps.forEach(q => q.updateDom());
        this.touchedComps.clear();
    }
}
exports.UiRenderContext = UiRenderContext;
function rsInterfaceStyleSheet() {
    let css = "";
    css += `html{color:white;font-size:12px;}\n`;
    css += ".rs-component{position:absolute;pointer-events:none;}\n";
    css += ".rs-component--highlight{outline:1px solid red;}\n";
    css += ".rs-image{width:100%;height:100%;}\n";
    css += ".rs-image--cover{background-size:100% 100%; background-repeat:no-repeat;}";
    css += ".rs-interface-container{position:absolute;top:0px;left:0px;right:0px;bottom:0px;display:flex;align-items:center;justify-content:center;}";
    css += ".rs-interface-container-sub{position:relative;outline:1px solid green;}";
    css += ".rs-model{position:absolute;top:0px;left:0px;width:100%;height:100%;}";
    css += ".rs-componentmeta{}";
    css += ".rs-componentmeta--active{outline:1px solid red;}";
    css += ".rs-componentmeta-children{padding-left:15px;}";
    return css;
}
function embeddedjsmodule(comps) {
    let getcomp = (id) => comps[id];
    let click = (event) => {
        console.log(getcomp(+event.target.dataset.compid));
        event.stopPropagation();
    };
    return { getcomp, click };
}
async function loadRsInterfaceData(ctx, id) {
    let arch = await ctx.source.getArchiveById(constants_1.cacheMajors.interfaces, id);
    let comps = new Map();
    for (let sub of arch) {
        try {
            let compid = (id << 16) | sub.fileid;
            if (ctx.comps.has(compid)) {
                throw new Error("ui render context already had comp with same id");
            }
            let comp = new RsInterfaceComponent(ctx, opdecoder_1.parse.interfaces.read(sub.buffer, ctx.source), compid);
            comps.set(sub.fileid, comp);
            ctx.comps.set(compid, comp);
        }
        catch (e) {
            console.log(`failed to parse interface ${id}:${sub.fileid}`);
        }
    }
    for (let [id, comp] of comps) {
        if (comp.data.parentid != 0xffff) {
            let parent = comps.get(comp.data.parentid);
            if (!parent) {
                console.log("missing parent");
                continue;
            }
            parent.children.push(comp);
        }
    }
    let rootcomps = [];
    for (let comp of comps.values()) {
        if (comp.data.parentid == 0xffff || !comps.has(comp.data.parentid)) {
            rootcomps.push(comp);
        }
    }
    let basewidth = 520;
    let baseheight = 340;
    return { comps, rootcomps, basewidth, baseheight, id };
}
async function renderRsInterfaceHTML(ctx, id) {
    let { comps, rootcomps, basewidth, baseheight } = await loadRsInterfaceData(ctx, id);
    let html = "";
    for (let comp of rootcomps) {
        html += await comp.toHtml(ctx);
    }
    let doc = `<!DOCTYPE html>\n`;
    doc += `<html>\n`;
    doc += `<head>\n`;
    doc += `<style>\n`;
    doc += rsInterfaceStyleSheet();
    doc += `</style>\n`;
    doc += "<script>\n";
    doc += `var mod=(${embeddedjsmodule + ""})(${JSON.stringify(Object.fromEntries([...comps].map(q => [q[0], q[1].data])))});\n`;
    doc += "</script>\n";
    doc += `</head>\n`;
    doc += `<body>\n`;
    doc += `<div class="rs-interface-container">\n`;
    doc += `<div style="width:${basewidth}px; height:${baseheight}px;">\n`;
    doc += html;
    doc += `</div>\n`;
    doc += `</div>\n`;
    doc += `</body>\n`;
    doc += `</html>\n`;
    return doc;
}
function renderRsInterfaceDOM(ctx, data) {
    let root = document.createElement("div");
    root.classList.add("rs-interface-container");
    let style = document.createElement("style");
    style.innerHTML = rsInterfaceStyleSheet();
    let container = document.createElement("div");
    container.classList.add("rs-interface-container-sub");
    container.style.width = data.basewidth + "px";
    container.style.height = data.baseheight + "px";
    root.appendChild(style);
    root.appendChild(container);
    for (let comp of data.rootcomps) {
        let sub = comp.initDom();
        container.appendChild(sub);
    }
    globalThis.comp = data.rootcomps; //TODO remove
    globalThis.compctx = ctx;
    let dispose = () => {
        data.rootcomps.forEach(q => q.dispose());
    };
    let loadprom;
    if (ctx.runOnloadScripts) {
        loadprom = (async () => {
            for (let comp of data.comps.values()) {
                if (comp.data.scripts.load.length != 0) {
                    await ctx.runClientScriptCallback(comp.compid, comp.data.scripts.load).catch(e => console.warn("comp load err", e));
                }
            }
        })();
    }
    else {
        loadprom = Promise.resolve();
    }
    return { el: root, container: container, rootcomps: data.rootcomps, interfaceid: data.id, dispose, loadprom };
}
function cssColor(col) {
    return `#${(col & 0xffffff).toString(16).padStart(6, "0")}`;
}
//TODO move this to customm css vars with container filters
function cssPosition(data) {
    let css = "";
    const defaulttranslate = "0px";
    let translatex = defaulttranslate;
    let translatey = defaulttranslate;
    if (data.aspectxtype == 0) {
        css += `left:${data.baseposx}px;`;
    }
    else if (data.aspectxtype == 1) {
        css += `left:50%;margin-left:${data.baseposx}px;`;
        translatex = "-50%";
    }
    else if (data.aspectxtype == 2) {
        css += `right:${data.baseposx}px;`;
    }
    else if (data.aspectxtype == 3) {
        css += `left:${data.baseposx * 100 / (1 << 14)}%;`;
    }
    else if (data.aspectxtype == 4) {
        css += `left:${50 + data.baseposx * 100 / (1 << 14)}%;`;
        translatex = "-50%";
    }
    else if (data.aspectxtype == 5) {
        css += `right:${data.baseposx * 100 / (1 << 14)}%;`;
    }
    if (data.aspectytype == 0) {
        css += `top:${data.baseposy}px;`;
    }
    else if (data.aspectytype == 1) {
        css += `top:50%;margin-top:${data.baseposy}px;`;
        translatey = "-50%";
    }
    else if (data.aspectytype == 2) {
        css += `bottom:${data.baseposy}px;`;
    }
    else if (data.aspectytype == 3) {
        css += `top:${data.baseposy * 100 / (1 << 14)};`;
    }
    else if (data.aspectytype == 4) {
        css += `top:${50 + data.baseposy * 100 / (1 << 14)}%;`;
        translatey = "-50%";
    }
    else if (data.aspectytype == 5) {
        css += `bottom:${data.baseposy * 100 / (1 << 14)}%;`;
    }
    if (translatex != defaulttranslate || translatey != defaulttranslate) {
        css += `translate:${translatex} ${translatey};`;
    }
    //TODO components are bounded to their parents bounds
    return css;
}
function cssSize(data) {
    let css = "";
    if (data.aspectwidthtype == 0) {
        css += `width:${data.basewidth}px;`;
    }
    else if (data.aspectwidthtype == 1) {
        css += `width:calc(100% - ${data.basewidth}px);`;
    }
    else if (data.aspectwidthtype == 2) {
        css += `width:${data.basewidth * 100 / (1 << 14)}%;`;
    }
    if (data.aspectheighttype == 0) {
        css += `height:${data.baseheight}px;`;
    }
    else if (data.aspectheighttype == 1) {
        css += `height:calc(100% - ${data.baseheight}px);`;
    }
    else if (data.aspectheighttype == 2) {
        css += `height:${data.baseheight * 100 / (1 << 14)}%;`;
    }
    return css;
}
function uiModelRenderer(renderer, sceneCache, camdata) {
    let camconfig = {
        rotx: camdata.rotate_x,
        roty: camdata.rotate_y,
        rotz: camdata.rotate_z,
        translatex: camdata.translate_x / 4,
        translatey: camdata.translate_y / 4,
        zoom: camdata.zoom * 8
    };
    let canvas = document.createElement("canvas");
    canvas.classList.add("rs-model");
    let modelrender = renderer.makeUIRenderer();
    let model = null;
    let setmodel = (modelid) => {
        model = new modelnodes_1.RSModel(sceneCache, [{ modelid, mods: {} }], `model_${modelid}`);
        modelrender.setmodel(model.getSceneElements(), 0);
        model.model.then(render);
    };
    let render = () => {
        let width = canvas.clientWidth;
        let height = canvas.clientHeight;
        if (width == 0 || height == 0) {
            return;
        }
        let img = modelrender.takePicture(width, height, camconfig);
        canvas.width = img.width;
        canvas.height = img.height;
        let ctx2d = canvas.getContext("2d");
        ctx2d.putImageData(img, 0, 0);
        if (animated && !animcb) {
            requestAnimationFrame(render);
        }
    };
    let animcb = 0;
    let animated = false;
    let setanim = (animid) => {
        if (animid == 0x7fff || animid == 0xffff) {
            animid = -1; //TODO move this check up somewhere into the json reader
        }
        model?.setAnimation(animid);
        animated = animid != -1;
        render();
    };
    let observer = new ResizeObserver(render);
    observer.observe(canvas);
    let dispose = () => {
        cancelAnimationFrame(animcb);
        animcb = 0;
        observer.disconnect();
        modelrender.dispose();
        canvas.remove();
    };
    canvas.render = render;
    return { dispose, canvas, setmodel, setanim };
}
function spriteCss(spritedata) {
    let imgstyle = "";
    if (spritedata.hflip || spritedata.vflip) {
        //TODO this doesn't handle the alpha channel correctly
        imgstyle += `scale:${spritedata.hflip ? -1 : 1} ${spritedata.vflip ? -1 : 1};`;
    }
    if (spritedata.rotation != 0) {
        imgstyle += `rotate:${(-spritedata.rotation / 0x10000 * 360).toFixed(2)}deg;`;
    }
    if ((spritedata.color & 0xffffff) != 0xffffff) {
        imgstyle += `background-color:${cssColor(spritedata.color)};background-blend-mode:multiply;`;
    }
    return imgstyle;
}
async function spritePromise(ctx, spriteid) {
    let imgcss = "none";
    let actualid = spriteid & 0xffffff;
    if (actualid != 0xffffff) {
        let flags = spriteid >> 24;
        if (flags != 0) {
            console.log("sprite flags", flags);
        }
        let spritebuf = await ctx.source.getFileById(constants_1.cacheMajors.sprites, actualid);
        let img = (0, sprite_1.expandSprite)((0, sprite_1.parseSprite)(spritebuf)[0]);
        let pngfile = await (0, imgutils_1.pixelsToDataUrl)(img);
        imgcss = `url('${pngfile}')`;
    }
    return { imgcss, spriteid };
}
class RsInterfaceComponent {
    ctx;
    data;
    parent = null;
    children = [];
    clientChildren = [];
    compid;
    modelrenderer = null;
    spriteChild = null;
    textChild = null;
    loadingSprite = -1;
    element = null;
    api;
    constructor(ctx, interfacedata, compid) {
        this.ctx = ctx;
        this.data = interfacedata;
        this.compid = compid;
        this.api = new CS2Api(this);
    }
    isCompType(type) {
        if (type == "container" && !this.data.containerdata) {
            return false;
        }
        if (type == "model" && !this.data.modeldata) {
            return false;
        }
        if (type == "sprite" && !this.data.spritedata) {
            return false;
        }
        if (type == "text" && !this.data.textdata) {
            return false;
        }
        if (type == "figure" && !this.data.figuredata) {
            return false;
        }
        return true;
    }
    async toHtml(ctx) {
        let { style, title } = this.getStyle();
        let childhtml = "";
        for (let child of this.children) {
            childhtml += await child.toHtml(ctx);
        }
        if (this.data.textdata) {
            childhtml += (0, utils_1.rsmarkupToSafeHtml)(this.data.textdata.text);
        }
        if (this.data.modeldata) {
            let isplaceholder = this.data.modeldata.modelid == 0x7fff || this.data.modeldata.modelid == 0xffff;
            style += "background:rgba(0,255,0,0.5);outline:blue;";
            childhtml += (isplaceholder ? "placeholder" : this.data.modeldata.modelid);
        }
        if (this.data.spritedata) {
            let spritecss = spriteCss(this.data.spritedata);
            let sprite = await spritePromise(ctx, this.data.spritedata.spriteid);
            spritecss += `background-image:${sprite.imgcss};`;
            childhtml += `<div class="rs-image${!this.data.spritedata.tiling ? " rs-image--cover" : ""}" style="${(0, utils_1.escapeHTML)(spritecss)}"></div>`;
        }
        let html = "";
        html += `<div class="rs-component" data-compid=${this.compid} style="${(0, utils_1.escapeHTML)(style)}" onclick="mod.click(event)" title="${(0, utils_1.escapeHTML)(title)}">\n`;
        html += childhtml;
        html += "</div>\n";
        return html;
    }
    dispose() {
        this.ctx.comps.delete(this.compid);
        this.modelrenderer?.dispose();
        this.element?.remove();
        this.children.forEach(q => q.dispose());
        this.clientChildren.forEach(q => q.dispose());
    }
    initDom() {
        this.element ??= document.createElement("div");
        this.updateDom();
        this.children.forEach(child => { this.element.appendChild(child.initDom()); });
        this.clientChildren.forEach(child => { this.element.appendChild(child.initDom()); });
        this.element.classList.add("rs-component");
        this.element.ui = this.data;
        this.element.compid = this.compid;
        return this.element;
    }
    updateDom() {
        if (!this.element) {
            throw new Error("element not set");
        }
        let { style, title } = this.getStyle();
        if (this.data.modeldata) {
            let isplaceholder = this.data.modeldata.modelid == 0x7fff || this.data.modeldata.modelid == 0xffff;
            if (!isplaceholder && this.ctx.renderer && this.ctx.sceneCache) {
                this.modelrenderer ??= uiModelRenderer(this.ctx.renderer, this.ctx.sceneCache, this.data.modeldata.positiondata);
                this.modelrenderer.setmodel(this.data.modeldata.modelid);
                this.modelrenderer.setanim(this.data.modeldata.animid);
                this.element.appendChild(this.modelrenderer.canvas);
            }
            else if (this.modelrenderer) {
                this.modelrenderer.dispose();
                this.modelrenderer = null;
                style += "background:rgba(0,255,0,0.5);outline:blue;";
                this.element.innerText = (isplaceholder ? "placeholder" : "");
            }
        }
        if (this.data.textdata) {
            if (!this.textChild) {
                this.textChild = document.createElement("span");
                this.element.appendChild(this.textChild);
            }
            this.textChild.innerHTML = (0, utils_1.rsmarkupToSafeHtml)(this.data.textdata.text);
        }
        else if (this.textChild) {
            this.textChild.remove();
            this.textChild = null;
        }
        if (this.data.spritedata) {
            if (this.loadingSprite != this.data.spritedata.spriteid) {
                if (!this.spriteChild) {
                    this.spriteChild = document.createElement("div");
                    this.element.appendChild(this.spriteChild);
                    this.spriteChild.classList.add("rs-image");
                }
                this.spriteChild.style.cssText = spriteCss(this.data.spritedata);
                this.spriteChild.classList.toggle("rs-image--cover", !this.data.spritedata.tiling);
                spritePromise(this.ctx, this.data.spritedata.spriteid).then(({ imgcss, spriteid }) => {
                    if (this.spriteChild && spriteid == this.data.spritedata?.spriteid) {
                        this.spriteChild.style.backgroundImage = imgcss;
                    }
                });
                this.loadingSprite = this.data.spritedata.spriteid;
            }
        }
        else if (this.spriteChild) {
            this.spriteChild.remove();
            this.spriteChild = null;
        }
        this.element.style.cssText = style;
        this.element.title = title;
    }
    getStyle() {
        let style = "";
        let childhtml = "";
        style += cssPosition(this.data);
        style += cssSize(this.data);
        let clickable = false;
        if (this.data.figuredata) {
            if (this.data.figuredata.filled) {
                style += `background:${cssColor(this.data.figuredata.color)};`;
                clickable = true;
            }
            else {
                style += `border:1px solid ${cssColor(this.data.figuredata.color)};`;
            }
        }
        else if (this.data.textdata) {
            clickable = true;
            style += "display:flex;";
            style += `color:${cssColor(this.data.textdata.color)};`;
            if (this.data.textdata.alignhor == 1) {
                style += `justify-content:center;`;
                style += `text-align:center;`; //need both here to support multi-line
            }
            else if (this.data.textdata.alignhor) {
                style += `justify-content:right;`;
                style += `text-align:right;`;
            }
            if (this.data.textdata.alignver == 1) {
                style += `align-items:center;`;
            }
            else if (this.data.textdata.alignver) {
                style += `align-items:bottom;`;
            }
            clickable = true;
        }
        else if (this.data.containerdata) {
            //nothing
        }
        else if (this.data.spritedata) {
        }
        else if (this.data.modeldata) {
            clickable = true;
        }
        else {
            style += "background:rgba(0,128,128,0.5);outline:red;";
            clickable = true;
        }
        if (clickable) {
            style += "pointer-events:initial;";
        }
        let title = this.data.rightclickopts.filter(q => q).join("\n");
        return { title, style };
    }
}
exports.RsInterfaceComponent = RsInterfaceComponent;
class CS2Api {
    data;
    comp;
    constructor(comp) {
        this.data = comp?.data ?? null;
        this.comp = comp;
    }
    changed() {
        this.comp?.ctx.touchedComps.add(this.comp);
    }
    findChild(ccid) {
        if (ccid == exports.MAGIC_CONST_IF_AS_CC) {
            return this;
        }
        return this.comp?.clientChildren.find(q => q.compid == ccid)?.api;
    }
    getNextChildId() {
        if (!this.comp) {
            return 0;
        }
        let max = this.comp.clientChildren.reduce((a, v) => Math.max(a, v.compid), -1);
        return max + 1;
    }
    createChild(ccid, type) {
        let data = {
            type: type,
            aspectxtype: 0,
            aspectytype: 0,
            aspectwidthtype: 0,
            aspectheighttype: 0,
            basewidth: 0,
            baseheight: 0,
            baseposx: 0,
            baseposy: 0,
            bit4data: 0,
            containerdata: null,
            spritedata: null,
            modeldata: null,
            figuredata: null,
            textdata: null,
            linedata: null,
            contenttype: -1,
            cursor: -1,
            hidden: 0,
            menucounts: 0,
            name: null,
            name2: "",
            optmask: 0,
            optmask1data_bit40: null,
            parentid: this.comp?.compid ?? -1,
            rightclickcursors: [],
            rightclickopts: [],
            scripts: {},
            unkdata: null,
            unk10data: null,
            unk11data: null,
            unk12data: null,
            unk15data: null,
            unk16data: null,
            unk2: 0,
            unk3: [],
            unk4: 0,
            unk5: 0,
            unk6: 0,
            unkdatadata: null,
            unkffff: null,
            unkpre3: null,
            unkprepre3: null,
            unkstring1: null,
            unkstuff123: "",
            unk13data: null,
            version: 7
        };
        if (type == 0) {
            data.containerdata = {
                layerwidth: 0,
                layerheight: 0,
                disablehover: null,
                layerheightextra: null,
                v6unk1: null,
                v6unk2: null
            };
        }
        else if (type == 3) {
            data.figuredata = {
                color: 0,
                filled: 0,
                trans: 0
            };
        }
        else if (type == 4) {
            data.textdata = {
                alignhor: 0,
                alignver: 0,
                color: 0,
                fontid: 0,
                multiline: null,
                shadow: false,
                text: "",
                trans: 0,
                unk1: 0,
                unk2: 0,
            };
        }
        else if (type == 5) {
            data.spritedata = {
                spriteid: -1,
                aspectheightdata: 0,
                aspectwidthdata: 0,
                borderthickness: 0,
                clickmask: null,
                color: 0xffffff,
                tiling: 0,
                hflip: false,
                vflip: false,
                transparency: 0,
                rotation: 0,
                unk2: 0,
                v6unk: 0
            };
        }
        else if (type == 6) {
            data.modeldata = {
                modelid: -1,
                animid: -1,
                aspectheightdata: 0,
                aspectwidthdata: 0,
                mode: 0,
                positiondata: {
                    rotate_x: 0,
                    rotate_y: 0,
                    rotate_z: 0,
                    translate_x: 0,
                    translate_y: 0,
                    unkextra: null,
                    zoom: 0
                },
                unkdata: null
            };
        }
        else {
            console.log(`creating unknown cc type, type=${type}, id=${ccid}`);
        }
        let api;
        if (this.comp) {
            let child = new RsInterfaceComponent(this.comp.ctx, data, ccid);
            this.comp.clientChildren.push(child);
            this.changed();
            child.api.changed();
            if (this.comp?.element) {
                //TODO defer this!
                this.comp.initDom();
            }
            api = child.api;
        }
        else {
            api = new CS2Api(null);
        }
        return api;
    }
    setSize(w, h, modew, modeh) {
        if (this.data) {
            this.data.basewidth = w;
            this.data.baseheight = h;
            this.data.aspectwidthtype = modew;
            this.data.aspectheighttype = modeh;
        }
        this.changed();
    }
    setPosition(x, y, modex, modey) {
        if (this.data) {
            this.data.baseposx = x;
            this.data.baseposy = y;
            this.data.aspectxtype = modex;
            this.data.aspectytype = modey;
        }
        this.changed();
    }
    setHide(hide) { this.data && (this.data.hidden = hide); }
    setWidth(w) { this.data && (this.data.basewidth = w); }
    setHeight(h) { this.data && (this.data.basewidth = h); }
    setX(x) { this.data && (this.data.baseposx = x); }
    setY(y) { this.data && (this.data.baseposy = y); }
    getHide() { return this.data?.hidden ?? 0; }
    getWidth() { return this.data?.basewidth ?? 0; }
    getHeight() { return this.data?.baseheight ?? 0; }
    getX() { return this.data?.baseposx ?? 0; }
    getY() { return this.data?.baseposy ?? 0; }
    setOp(index, text) { console.log(`setop ${this.comp?.compid ?? -1} ${index} ${text}`); } //TODO
    getOp(index) { return this.data?.rightclickopts[index] ?? ""; }
    //text
    setText(text) { if (this.data?.textdata) {
        this.data.textdata.text = text;
    } }
    getText() { return this.data?.textdata?.text ?? ""; }
    setTextAlign(a, b, c) { this.data?.textdata && (this.data.textdata.alignhor = c, this.data.textdata.alignver = b, this.data.textdata.multiline = a | 0); }
    getTextAlign() { return [this.data?.textdata?.alignhor ?? 0, this.data?.textdata?.alignver ?? 0, this.data?.textdata?.multiline ?? 0]; }
    //sprite
    getGraphic() { return this.data?.spritedata?.spriteid ?? -1; }
    getHFlip() { return this.data?.spritedata?.hflip ?? false; }
    getVFlip() { return this.data?.spritedata?.vflip ?? false; }
    getTiling() { return this.data?.spritedata?.tiling ?? 0; }
    getRotation() { return this.data?.spritedata?.rotation ?? 0; }
    setGraphic(sprite) { this.data?.spritedata && (this.data.spritedata.spriteid = sprite); this.changed(); }
    setHFlip(flip) { this.data?.spritedata && (this.data.spritedata.hflip = flip); this.changed(); }
    setVFlip(flip) { this.data?.spritedata && (this.data.spritedata.vflip = flip); this.changed(); }
    setTiling(tiling) { this.data?.spritedata && (this.data.spritedata.tiling = tiling); this.changed(); }
    setRotation(rot) { this.data?.spritedata && (this.data.spritedata.rotation = rot); this.changed(); }
    //model
    setModel(id) { this.data?.modeldata && (this.data.modeldata.modelid = id); this.changed(); }
    getModel() { return this.data?.modeldata?.modelid ?? -1; }
    //figure
    getTrans() { return this.data?.figuredata?.trans ?? 0; }
    setTrans(trans) { this.data?.figuredata && (this.data.figuredata.trans = trans); this.changed(); }
    getFilled() { return this.data?.figuredata?.filled ?? 0; }
    setFilled(filled) { this.data?.figuredata && (this.data.figuredata.filled = filled); this.changed(); }
    getColor() { return this.data?.figuredata?.color ?? 0; }
    setColor(col) { this.data?.figuredata && (this.data.figuredata.color = col); this.changed(); }
}
exports.CS2Api = CS2Api;
