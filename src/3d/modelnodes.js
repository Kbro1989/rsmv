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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSMapChunk = exports.RSMapChunkGroup = exports.RSModel = void 0;
exports.castModelInfo = castModelInfo;
exports.modelToModel = modelToModel;
exports.playerDataToModel = playerDataToModel;
exports.playerToModel = playerToModel;
exports.npcBodyToModel = npcBodyToModel;
exports.npcToModel = npcToModel;
exports.spotAnimToModel = spotAnimToModel;
exports.locToModel = locToModel;
exports.itemToModel = itemToModel;
exports.materialToModel = materialToModel;
exports.serializeAnimset = serializeAnimset;
const opdecoder_1 = require("../opdecoder");
const avatar_1 = require("./avatar");
const THREE = __importStar(require("three"));
const modeltothree_1 = require("../3d/modeltothree");
const utils_1 = require("../utils");
const mapsquare_1 = require("../3d/mapsquare");
const three_1 = require("three");
const animationframes_1 = require("../3d/animationframes");
const constants_1 = require("../constants");
const animationskeletal_1 = require("../3d/animationskeletal");
const svgrender_1 = require("../map/svgrender");
const node_fetch_1 = __importDefault(require("node-fetch"));
const legacycache_1 = require("../cache/legacycache");
const classicloader_1 = require("../cache/classicloader");
//typescript helper to force type inference
function castModelInfo(info) {
    return info;
}
async function modelToModel(cache, id) {
    let modeldata = await cache.getModelData(id);
    //getting the same file a 2nd time to get the full json
    let info;
    if (cache.modelType == "classic") {
        let arch = await cache.engine.getArchiveById(0, classicloader_1.classicGroups.models);
        info = opdecoder_1.parse.classicmodels.read(arch[id].buffer, cache.engine.rawsource);
    }
    else if (cache.modelType == "old") {
        let major = (cache.engine.legacyData ? legacycache_1.legacyMajors.oldmodels : constants_1.cacheMajors.oldmodels);
        info = opdecoder_1.parse.oldmodels.read(await cache.engine.getFileById(major, id), cache.engine.rawsource);
    }
    else if (cache.modelType == "nxt") {
        info = opdecoder_1.parse.models.read(await cache.engine.getFileById(constants_1.cacheMajors.models, id), cache.engine.rawsource);
    }
    return castModelInfo({
        models: [{ modelid: id, mods: {} }],
        anims: {},
        info: { modeldata, info },
        id,
        name: `model:${id}`
    });
}
async function playerDataToModel(cache, modeldata) {
    let avainfo = await (0, avatar_1.avatarToModel)(cache.engine, modeldata.data, modeldata.head);
    return castModelInfo({
        ...avainfo,
        id: modeldata,
        name: modeldata.player
    });
}
async function playerToModel(cache, name) {
    let avadata = "";
    if (name.length <= 20) {
        let url = (0, avatar_1.appearanceUrl)(name);
        let data = await (0, node_fetch_1.default)(url).then(q => q.text());
        if (data.indexOf("404 - Page not found") != -1) {
            throw new Error("player avatar not found");
        }
        avadata = data;
    }
    else {
        avadata = name;
    }
    let avainfo = await (0, avatar_1.avatarToModel)(cache.engine, (0, avatar_1.avatarStringToBytes)(avadata), false);
    return castModelInfo({
        ...avainfo,
        id: name,
        name: name
    });
}
async function npcBodyToModel(cache, id) {
    return npcToModel(cache, { id, head: false });
}
async function npcToModel(cache, id) {
    let npc = opdecoder_1.parse.npc.read(await cache.engine.getGameFile("npcs", id.id), cache.engine.rawsource);
    let anims = {};
    let modelids = (id.head ? npc.headModels : npc.models) ?? [];
    if (!id.head && npc.animation_group) {
        let arch = await cache.engine.getArchiveById(constants_1.cacheMajors.config, constants_1.cacheConfigPages.animgroups);
        let animgroup = opdecoder_1.parse.animgroupConfigs.read(arch[npc.animation_group].buffer, cache.engine.rawsource);
        anims = serializeAnimset(animgroup);
    }
    let mods = {};
    if (npc.color_replacements) {
        mods.replaceColors = npc.color_replacements;
    }
    if (npc.material_replacements) {
        mods.replaceMaterials = npc.material_replacements;
    }
    let models = modelids.map(q => ({ modelid: q, mods }));
    return castModelInfo({
        info: npc,
        models,
        anims,
        id,
        name: npc.name ?? `npc:${id.id}`
    });
}
async function spotAnimToModel(cache, id) {
    let animdata = opdecoder_1.parse.spotAnims.read(await cache.engine.getGameFile("spotanims", id), cache.engine.rawsource);
    let mods = {};
    if (animdata.replace_colors) {
        mods.replaceColors = animdata.replace_colors;
    }
    if (animdata.replace_materials) {
        mods.replaceMaterials = animdata.replace_materials;
    }
    let models = (animdata.model ? [{ modelid: animdata.model, mods }] : []);
    let anims = {};
    if (animdata.sequence) {
        anims.default = animdata.sequence;
    }
    return castModelInfo({
        models,
        anims,
        info: animdata,
        id,
        name: `spotanim:${id}`
    });
}
async function locToModel(cache, id) {
    let { morphedloc } = await (0, mapsquare_1.resolveMorphedObject)(cache.engine, id);
    let mods = {};
    let anims = {};
    let models = [];
    if (morphedloc) {
        if (morphedloc.color_replacements) {
            mods.replaceColors = morphedloc.color_replacements;
        }
        if (morphedloc.material_replacements) {
            mods.replaceMaterials = morphedloc.material_replacements;
        }
        if (cache.engine.getBuildNr() > constants_1.lastClassicBuildnr && cache.engine.getBuildNr() < 377) {
            //old caches just use one prop to replace both somehow
            mods.replaceMaterials = mods.replaceColors;
        }
        models = [
            ...morphedloc.models?.flatMap(m => m.values).map(q => ({ modelid: q, mods })) ?? [],
            ...morphedloc.models_05?.models.flatMap(m => m.values).map(q => ({ modelid: q, mods })) ?? []
        ];
    }
    if (morphedloc?.probably_animation) {
        anims.default = morphedloc.probably_animation;
    }
    return castModelInfo({
        models,
        anims,
        info: morphedloc,
        id,
        name: morphedloc.name ?? `loc:${id}`
    });
}
async function itemToModel(cache, id) {
    let item = opdecoder_1.parse.item.read(await cache.engine.getGameFile("items", id), cache.engine.rawsource);
    if (!item.baseModel && item.noteTemplate) {
        item = opdecoder_1.parse.item.read(await cache.engine.getGameFile("items", item.noteTemplate), cache.engine.rawsource);
    }
    let mods = {};
    if (item.color_replacements) {
        mods.replaceColors = item.color_replacements;
    }
    if (item.material_replacements) {
        mods.replaceMaterials = item.material_replacements;
    }
    let models = (item.baseModel ? [{ modelid: item.baseModel, mods }] : []);
    return castModelInfo({
        models,
        anims: {},
        info: item,
        id,
        name: item.name ?? `item:${id}`
    });
}
async function materialToModel(sceneCache, id) {
    let assetid = modeltothree_1.constModelsIds.materialCube;
    let mods = {
        replaceMaterials: [[0, id]]
    };
    let mat = sceneCache.engine.getMaterialData(id);
    let texs = {};
    let addtex = async (type, name, texid) => {
        let tex = await sceneCache.getTextureFile(type, texid, mat.stripDiffuseAlpha && name == "diffuse");
        let drawable = await tex.toWebgl();
        texs[name] = { texid, filesize: tex.filesize, img0: drawable };
    };
    for (let tex in mat.textures) {
        if (mat.textures[tex] != 0) {
            await addtex(tex, tex, mat.textures[tex]);
        }
    }
    return castModelInfo({
        models: [{ modelid: assetid, mods }],
        anims: {},
        info: { texs, obj: mat },
        id: id,
        name: `material:${id}`
    });
}
class RSModel extends utils_1.TypedEmitter {
    model;
    loaded = null;
    cache;
    rootnode = new THREE.Group();
    nullAnimPromise = { clip: null, prom: new utils_1.CallbackPromise() };
    anims = {
        "-1": this.nullAnimPromise
    };
    mountedanim = null;
    mixer = new three_1.AnimationMixer(this.rootnode);
    renderscene = null;
    targetAnimId = -1;
    skeletontype = "none";
    skeletonHelper = null;
    cleanup() {
        this.listeners = {};
        this.renderscene?.removeSceneElement(this);
        this.skeletonHelper?.removeFromParent();
        this.renderscene = null;
    }
    getSceneElements() {
        return {
            modelnode: this.rootnode,
            updateAnimation: this.updateAnimation
        };
    }
    addToScene(scene) {
        this.renderscene = scene;
        scene.addSceneElement(this);
    }
    onModelLoaded = () => {
        this.emit("loaded", undefined);
        this.renderscene?.forceFrame();
        this.renderscene?.setCameraLimits();
    };
    updateAnimation = (delta, epochtime) => {
        this.mixer.update(delta);
        this.loaded?.matUvAnims.forEach(q => q.tex.offset.copy(q.v).multiplyScalar(epochtime));
    };
    constructor(cache, models, name = "") {
        super();
        this.cache = cache;
        this.model = (async () => {
            let meshdatas = await Promise.all(models.map(async (modelinit) => {
                let meshdata = await cache.getModelData(modelinit.modelid);
                let modified = {
                    ...meshdata,
                    meshes: meshdata.meshes.map(q => (0, mapsquare_1.modifyMesh)(q, modelinit.mods))
                };
                return modified;
            }));
            let modeldata = (0, modeltothree_1.mergeModelDatas)(meshdatas);
            (0, modeltothree_1.mergeBoneids)(modeldata);
            let mesh = await (0, modeltothree_1.ob3ModelToThree)(this.cache, modeldata);
            mesh.name = name;
            let nullbones = [];
            for (let i = 0; i < Math.max(modeldata.bonecount, modeldata.skincount); i++) {
                nullbones.push(mesh);
            }
            let nullskel = new three_1.Skeleton(nullbones);
            let matUvAnims = [];
            mesh.traverse(node => {
                if (node instanceof three_1.SkinnedMesh) {
                    node.bind(nullskel);
                }
                if (node instanceof three_1.Mesh && node.material instanceof three_1.Material) {
                    let uvExt = node.material.userData.gltfExtensions?.RA_materials_uvanim;
                    if (uvExt) {
                        let mat = node.material;
                        let animvec = new three_1.Vector2(uvExt.uvAnim[0], uvExt.uvAnim[1]);
                        if (mat.map) {
                            matUvAnims.push({ tex: mat.map, v: animvec });
                        }
                        if (mat.normalMap) {
                            matUvAnims.push({ tex: mat.normalMap, v: animvec });
                        }
                        if (mat.emissiveMap) {
                            matUvAnims.push({ tex: mat.emissiveMap, v: animvec });
                        }
                        if (mat.metalnessMap) {
                            matUvAnims.push({ tex: mat.metalnessMap, v: animvec });
                        }
                        if (mat.roughnessMap) {
                            matUvAnims.push({ tex: mat.roughnessMap, v: animvec });
                        }
                    }
                }
            });
            let nullAnim = new three_1.AnimationClip(undefined, undefined, []);
            this.nullAnimPromise.clip = nullAnim;
            this.nullAnimPromise.prom.done(nullAnim);
            this.rootnode.add(mesh);
            this.loaded = { mesh, modeldata, nullAnim, matUvAnims };
            if (this.targetAnimId == -1) {
                this.setAnimation(-1);
            }
            this.onModelLoaded();
            return this.loaded;
        })();
    }
    mountAnim(clip) {
        if (!this.loaded) {
            throw new Error("attempting to mount anim before model is loaded");
        }
        if (this.mountedanim == clip) {
            return;
        }
        //TODO is this required?
        if (this.loaded.modeldata.bonecount == 0 && this.loaded.modeldata.skincount == 0) {
            return;
        }
        let mesh = this.loaded.mesh;
        if (mesh.animations.indexOf(clip) == -1) {
            mesh.animations.push(clip);
        }
        this.mixer.stopAllAction();
        let action = this.mixer.clipAction(clip, mesh);
        action.play();
        // this.skeletonHelper?.removeFromParent();
        // this.skeletonHelper = new SkeletonHelper(mesh);
        // (this.renderscene as any)?.scene.add(this.skeletonHelper);
        this.mountedanim = clip;
    }
    loadAnimation(animid) {
        if (this.anims[animid]) {
            return this.anims[animid];
        }
        this.anims[animid] = {
            clip: null,
            prom: (async () => {
                let seqfile = await this.cache.engine.getFileById(constants_1.cacheMajors.sequences, animid);
                let seq = opdecoder_1.parse.sequences.read(seqfile, this.cache.engine.rawsource);
                let clip;
                if (seq.skeletal_animation) {
                    let anim = await (0, animationskeletal_1.parseSkeletalAnimation)(this.cache, seq.skeletal_animation);
                    clip = anim.clip;
                    let loaded = this.loaded ?? await this.model;
                    if (this.skeletontype != "full") {
                        if (this.skeletontype != "none") {
                            throw new Error("wrong skeleton type already mounted to model");
                        }
                        await (0, animationskeletal_1.mountSkeletalSkeleton)(loaded.mesh, this.cache, anim.framebaseid);
                        this.skeletontype = "full";
                    }
                }
                else if (seq.frames) {
                    let frameanim = await (0, animationframes_1.parseAnimationSequence4)(this.cache, seq.frames);
                    let loaded = this.loaded ?? await this.model;
                    if (this.skeletontype != "baked") {
                        if (this.skeletontype != "none") {
                            throw new Error("wrong skeleton type already mounted to model");
                        }
                        (0, animationframes_1.mountBakedSkeleton)(loaded.mesh, loaded.modeldata);
                        this.skeletontype = "baked";
                    }
                    clip = frameanim(loaded.modeldata);
                }
                else {
                    throw new Error("animation has no frames");
                }
                this.anims[animid] = { clip, prom: Promise.resolve(clip) };
                if (!this.loaded?.modeldata) {
                    await this.model;
                }
                this.anims[animid].clip = clip;
                return clip;
            })()
        };
        return this.anims[animid];
    }
    async setAnimation(animid) {
        this.targetAnimId = animid;
        const mount = this.loadAnimation(animid);
        return this.mountAnim(mount.clip ?? await mount.prom);
    }
}
exports.RSModel = RSModel;
class RSMapChunkGroup extends utils_1.TypedEmitter {
    chunks;
    rootnode = new THREE.Group();
    renderscene = null;
    mixer = new three_1.AnimationMixer(this.rootnode);
    getSceneElements() {
        return this.chunks.map(q => q.getSceneElements());
    }
    addToScene(scene) {
        this.renderscene = scene;
        scene.addSceneElement(this);
    }
    cleanup() {
        this.listeners = {};
        this.chunks.forEach(q => q.cleanup());
        this.renderscene?.removeSceneElement(this);
        this.renderscene = null;
    }
    constructor(cache, rect, extraopts) {
        super();
        this.chunks = [];
        for (let z = rect.z; z < rect.z + rect.zsize; z++) {
            for (let x = rect.x; x < rect.x + rect.xsize; x++) {
                let sub = RSMapChunk.create(cache, x, z, extraopts);
                this.chunks.push(sub);
            }
        }
        Promise.all(this.chunks.map(q => q.chunkdata)).then(q => {
            this.emit("loaded", undefined);
        });
    }
}
exports.RSMapChunkGroup = RSMapChunkGroup;
class RSMapChunk extends utils_1.TypedEmitter {
    chunkdata;
    loaded = null;
    cache;
    rootnode = new THREE.Group();
    mixer = new three_1.AnimationMixer(this.rootnode);
    renderscene = null;
    toggles = {};
    chunkx;
    chunkz;
    globalname = "";
    constructor(cache, preparsed, chunkx, chunkz, opts) {
        super();
        this.cache = cache;
        this.chunkx = chunkx;
        this.chunkz = chunkz;
        this.chunkdata = (async () => {
            this.loaded = await (0, mapsquare_1.renderMapSquare)(cache, preparsed, chunkx, chunkz, opts);
            this.rootnode.add(this.loaded.chunkroot);
            this.onModelLoaded();
            return this.loaded;
        })();
    }
    static defaultopts(extraopts) {
        let opts = { invisibleLayers: true, collision: true, map2d: false, padfloor: true, skybox: false, minimap: false, ...extraopts };
        return opts;
    }
    static create(cache, chunkx, chunkz, extraopts) {
        let opts = this.defaultopts(extraopts);
        let preparsed = (0, mapsquare_1.parseMapsquare)(cache.engine, chunkx, chunkz, opts);
        return new RSMapChunk(cache, preparsed, chunkx, chunkz, opts);
    }
    //TODO remove
    async testLocImg(loc) {
        if (!this.loaded) {
            throw new Error("not loaded");
        }
        let model = this.loaded?.locRenders.get(loc) ?? [];
        let sections = model.map(q => q.mesh.cloneSection(q));
        model.map(q => q.mesh.setSectionHide(q, true));
        let group = new three_1.Object3D();
        group.add(...sections.map(q => q.mesh));
        group.traverse(q => q.layers.set(1));
        this.loaded.chunkroot.add(group);
        // let cam = mapImageCamera(loc.x + this.rootnode.position.x / tiledimensions - 16, loc.z + this.rootnode.position.z / tiledimensions - 16, 32, 0.15, 0.25);
        let cam = this.renderscene.getCurrent2dCamera();
        let img = await this.renderscene.takeMapPicture(cam, 256, 256, false, group);
        group.removeFromParent();
        model.map(q => q.mesh.setSectionHide(q, false));
        return img;
    }
    cloneLocModel(entry) {
        return entry.map(q => q.mesh.cloneSection(q));
    }
    replaceLocModel(loc, newmodels) {
        let entry = this.loaded?.locRenders.get(loc) ?? [];
        entry.forEach(q => q.mesh.setSectionHide(q, true));
        if (!newmodels) {
            this.loaded?.locRenders.delete(loc);
        }
        else {
            this.loaded?.locRenders.set(loc, newmodels);
            newmodels.forEach(q => q.mesh.setSectionHide(q, false));
        }
        return entry;
    }
    cleanup() {
        this.listeners = {};
        if (this.globalname) {
            delete globalThis[this.globalname];
            this.globalname = "";
        }
        //only clear vertex memory for now, materials might be reused and are up to the scenecache
        this.chunkdata.then(q => q.chunkroot.traverse(obj => {
            if (obj instanceof three_1.Mesh) {
                obj.geometry.dispose();
            }
        }));
        this.renderscene?.removeSceneElement(this);
        this.renderscene = null;
    }
    async renderSvg(level = 0, wallsonly = false, pxpersquare = 1) {
        let { chunk, grid, chunkSize, chunkx, chunkz } = await this.chunkdata;
        let rect = { x: chunkx * chunkSize, z: chunkz * chunkSize, xsize: chunkSize, zsize: chunkSize };
        return (0, svgrender_1.svgfloor)(this.cache.engine, grid, chunk?.locs ?? [], rect, level, pxpersquare, wallsonly, false);
    }
    getSceneElements() {
        return {
            modelnode: this.rootnode,
            sky: this.loaded?.sky,
            options: { hideFloor: true }
        };
    }
    addToScene(scene) {
        //still leaks memory when using multiple renderers
        if (this.renderscene == null && globalThis.debugchunks) {
            for (let i = 0; i < 10; i++) {
                let name = `chunk_${this.chunkx}_${this.chunkz}${i == 0 ? "" : `_${i}`}`;
                if (!globalThis[name]) {
                    globalThis[name] = this;
                    this.globalname = name;
                    break;
                }
            }
        }
        this.renderscene = scene;
        scene.addSceneElement(this);
    }
    onModelLoaded() {
        this.setToggles(this.toggles);
        this.emit("loaded", this.loaded);
        this.emit("changed", undefined);
        this.renderscene?.sceneElementsChanged();
        // this.renderscene?.setCameraLimits();//TODO fix this, current bounding box calc is too large
    }
    setToggles(toggles, hideall = false) {
        this.toggles = toggles;
        this.rootnode.traverse(node => {
            if (node.userData.modelgroup) {
                let newvis = (hideall ? false : toggles[node.userData.modelgroup] ?? true);
                node.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        child.visible = newvis;
                    }
                });
            }
        });
    }
}
exports.RSMapChunk = RSMapChunk;
function serializeAnimset(group) {
    let anims = {};
    let addanim = (name, id) => {
        if (id != -1 && Object.values(anims).indexOf(id) == -1) {
            anims[name] = id;
        }
    };
    anims.none = -1;
    if (group.baseAnims) {
        addanim("default", group.baseAnims.idle);
        addanim("walk", group.baseAnims.walk);
    }
    if (group.run) {
        addanim("run", group.run);
    }
    if (group.idleVariations) {
        let totalchance = group.idleVariations.reduce((a, v) => a + v.probably_chance, 0);
        for (let [i, variation] of group.idleVariations.entries()) {
            addanim(i == 0 ? "default" : `idle${i}_${variation.probably_chance}/${totalchance}`, variation.animid);
        }
    }
    //TODO yikes, this object is not a map
    for (let [key, val] of Object.entries(group)) {
        if (typeof val == "number") {
            addanim(key, group[key]);
        }
    }
    return anims;
}
