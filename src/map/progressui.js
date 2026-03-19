"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressUI = void 0;
class ProgressUI {
    areas;
    tiles = new Map();
    props = {};
    root;
    proproot;
    grid;
    updateDebounce = 0;
    queuedUpdates = [];
    static renderBackgrounds = {
        loaded: "lime",
        loading: "red",
        unloaded: "green"
    };
    static backgrounds = {
        queued: "black",
        imaging: "orange",
        saving: "yellow",
        done: "green",
        skipped: "darkgreen"
    };
    constructor() {
        this.areas = [];
        this.grid = document.createElement("div");
        this.grid.style.display = "grid";
        this.proproot = document.createElement("div");
        let root = document.createElement("div");
        root.style.display = "grid";
        root.style.grid = "'a b'/auto 1fr";
        root.appendChild(this.grid);
        root.appendChild(this.proproot);
        this.root = root;
    }
    setAreas(areas) {
        this.areas = areas;
        this.grid.replaceChildren();
        let minx = Infinity, minz = Infinity;
        let maxx = -Infinity, maxz = -Infinity;
        for (let area of areas) {
            minx = Math.min(minx, area.x);
            minz = Math.min(minz, area.z);
            maxx = Math.max(maxx, area.x + area.xsize - 1);
            maxz = Math.max(maxz, area.z + area.zsize - 1);
            for (let dz = 0; dz < area.zsize; dz++) {
                for (let dx = 0; dx < area.xsize; dx++) {
                    let id = `${area.x + dx}-${area.z + dz}`;
                    if (!this.tiles.has(id)) {
                        let el = document.createElement("div");
                        this.tiles.set(id, { x: area.x + dx, z: area.z + dz, el, progress: "queued", loadstate: "unloaded" });
                    }
                }
            }
        }
        const maxheight = 930;
        const maxwidth = 700;
        let scale = Math.min(maxwidth / (maxx - minx + 1), maxheight / (maxz - minz + 1));
        this.grid.style.width = `${(maxx - minx + 1) * scale}px`;
        this.grid.style.height = `${(maxz - minz + 1) * scale}px`;
        this.grid.style.gridTemplateColumns = `repeat(${maxx - minx + 1},1fr)`;
        this.grid.style.gridTemplateRows = `repeat(${maxz - minz + 1},1fr)`;
        this.proproot.style.left = `${(maxx - minx + 1) * scale}px`;
        for (let tile of this.tiles.values()) {
            tile.el.style.gridColumn = (tile.x - minx + 1) + "";
            tile.el.style.gridRow = (maxz - minz - (tile.z - minz) + 1) + "";
            tile.el.style.background = ProgressUI.backgrounds.queued;
            this.grid.appendChild(tile.el);
        }
    }
    update(x, z, state, tilestate = "") {
        this.queuedUpdates.push({ x, z, state, tilestate });
        if (!this.updateDebounce) {
            this.updateDebounce = +setTimeout(() => {
                this.queuedUpdates.forEach(q => this.doupdate(q.x, q.z, q.state, q.tilestate));
                this.queuedUpdates = [];
                this.updateDebounce = 0;
            }, 400);
        }
    }
    doupdate(x, z, state, tilestate = "") {
        let id = `${x}-${z}`;
        let tile = this.tiles.get(id);
        if (!tile) {
            return;
        }
        if (state) {
            tile.progress = state;
        }
        if (tilestate) {
            tile.loadstate = tilestate;
        }
        if (tile.progress == "imaging" || tile.progress == "saving") {
            tile.el.style.background = ProgressUI.backgrounds[tile.progress];
        }
        else if (tile.loadstate != "unloaded") {
            tile.el.style.background = ProgressUI.renderBackgrounds[tile.loadstate];
        }
        else {
            tile.el.style.background = ProgressUI.backgrounds[tile.progress];
        }
    }
    updateProp(propname, value) {
        let prop = this.props[propname];
        if (!value && prop) {
            this.proproot.removeChild(prop.el);
            delete this.props[propname];
            return;
        }
        if (value && !prop) {
            let titleel = document.createElement("b");
            let contentel = document.createElement("span");
            let el = document.createElement("div");
            el.append(titleel, contentel);
            titleel.innerText = propname + ": ";
            prop = { el, contentel, text: "" };
            this.props[propname] = prop;
            this.proproot.appendChild(prop.el);
        }
        prop.text = value;
        prop.contentel.innerText = value;
    }
}
exports.ProgressUI = ProgressUI;
