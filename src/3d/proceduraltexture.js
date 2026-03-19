"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProcTexture = loadProcTexture;
exports.debugProcTexture = debugProcTexture;
const proctexes_1 = require("../libs/proctexes");
const constants_1 = require("../constants");
const sprite_1 = require("./sprite");
const imgutils_1 = require("../imgutils");
class TextureGroup {
    textures = [];
    sprites = [];
    parent;
    filesize = 0;
    getTexture(id) {
        let index = this.parent.textureIds.indexOf(id);
        if (index != -1 && this.textures[index]) {
            return this.textures[index];
        }
        throw new Error("texture not loaded");
    }
    getSprite(id) {
        let index = this.parent.spriteIds.indexOf(id);
        if (index != -1 && this.sprites[index]) {
            return this.sprites[index];
        }
        throw new Error("sprite not loaded");
    }
    constructor(tex) {
        this.parent = tex;
    }
    static async create(engine, tex) {
        let group = new TextureGroup(tex);
        for (let texid of tex.textureIds) {
            //currently has a problem with gamma correction happenning twice, 
            //TODO check texture 669 in openrs2:309, it references texture 1 but is much darker
            let subtex = await loadProcTexture(engine, texid, undefined, true);
            group.textures.push(subtex.img);
            group.filesize += subtex.filesize;
        }
        for (let spriteid of tex.spriteIds) {
            let spritefile = await engine.getFileById(constants_1.cacheMajors.sprites, spriteid);
            let sprite = (0, sprite_1.parseSprite)(spritefile);
            group.sprites.push(sprite[0].img);
            group.filesize += spritefile.byteLength;
        }
        return group;
    }
}
async function loadProcTexture(engine, id, size = 256, raw = false) {
    let buf = await engine.getFileById(constants_1.cacheMajors.texturesOldPng, id);
    let filesize = buf.byteLength;
    let javabuf = new proctexes_1.Buffer([...buf]);
    let tex = new proctexes_1.Texture(javabuf);
    let deps = await TextureGroup.create(engine, tex);
    filesize += deps.filesize;
    let img = renderProcTexture(tex, deps, size, raw);
    return { img, filesize, tex, deps };
}
function renderProcTexture(tex, group, size, raw = false) {
    //2.2=srgb gamma
    let pixels = tex.getPixels(size, size, group, (raw ? 1 : 1 / 2.2), false, !raw);
    let img = new ImageData(size, size);
    for (let i = 0; i < pixels.length; i++) {
        img.data[i * 4 + 0] = (pixels[i] >> 16) & 0xff;
        img.data[i * 4 + 1] = (pixels[i] >> 8) & 0xff;
        img.data[i * 4 + 2] = (pixels[i] >> 0) & 0xff;
        img.data[i * 4 + 3] = 255;
    }
    return img;
}
async function debugProcTexture(engine, id, size = 128) {
    let { tex, deps } = await loadProcTexture(engine, id, size);
    let debugsub = (op, parent) => {
        let oldcolorop = tex.colorOp;
        tex.colorOp = op;
        let img = renderProcTexture(tex, deps, size);
        tex.colorOp = oldcolorop;
        let cnv = (0, imgutils_1.dumpTexture)(img);
        parent.append(cnv);
        cnv.style.position = "initial";
        cnv.style.width = "fit-content";
        cnv.title = op.constructor.name;
        cnv.onclick = () => console.log(op);
        if (op.childOps.length > 1) {
            let subs = document.createElement("div");
            subs.style.display = "flex";
            subs.style.flexDirection = "row";
            subs.style.backgroundColor = "rgba(0,0,0,0.2)";
            subs.style.border = "solid green";
            subs.style.borderWidth = "10px 2px 0px";
            parent.append(subs);
            parent = subs;
        }
        for (let sub of op.childOps) {
            let newparent = parent;
            if (op.childOps.length > 1) {
                let row = document.createElement("div");
                row.style.display = "flex";
                row.style.flexDirection = "column";
                row.style.alignItems = "center";
                parent.append(row);
                newparent = row;
            }
            debugsub(sub, newparent);
        }
    };
    let rootel = document.createElement("div");
    rootel.style.position = "absolute";
    rootel.style.top = "5px";
    rootel.style.left = "5px";
    rootel.style.display = "flex";
    rootel.style.flexDirection = "column";
    rootel.style.alignItems = "center";
    rootel.style.width = "fit-content";
    debugsub(tex.colorOp, rootel);
    return rootel;
}
