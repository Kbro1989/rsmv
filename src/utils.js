"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeakRefMap = exports.IterableWeakMap = exports.FetchThrottler = exports.CallbackPromise = exports.TypedEmitter = exports.Stream = void 0;
exports.checkObject = checkObject;
exports.cacheFilenameHash = cacheFilenameHash;
exports.stringToMapArea = stringToMapArea;
exports.stringToFileRange = stringToFileRange;
exports.getOrInsert = getOrInsert;
exports.delay = delay;
exports.posmod = posmod;
exports.escapeHTML = escapeHTML;
exports.rsmarkupToSafeHtml = rsmarkupToSafeHtml;
exports.arrayEnum = arrayEnum;
exports.constrainedMap = constrainedMap;
exports.flipEndian16 = flipEndian16;
exports.ushortToHalf = ushortToHalf;
exports.HSL2RGBfloat = HSL2RGBfloat;
exports.HSL2RGB = HSL2RGB;
exports.RGB2HSL = RGB2HSL;
exports.HSL2packHSL = HSL2packHSL;
exports.packedHSL2HSL = packedHSL2HSL;
exports.trickleTasks = trickleTasks;
exports.trickleTasksTwoStep = trickleTasksTwoStep;
exports.findParentElement = findParentElement;
function checkObject(obj, props) {
    if (!obj || typeof obj != "object") {
        return null;
    }
    let res = {};
    for (let [key, type] of Object.entries(props)) {
        if (!(key in obj) && typeof obj[key] != type) {
            return null;
        }
        res[key] = obj[key];
    }
    return res;
}
function cacheFilenameHash(name, oldhash) {
    let hash = 0;
    if (oldhash) {
        name = name.toUpperCase();
        for (let ch of name) {
            hash = (Math.imul(hash, 61) + ch.charCodeAt(0) - 32) | 0;
        }
    }
    else {
        for (let ch of name) {
            hash = (((hash << 5) - hash) | 0) + ch.charCodeAt(0) | 0;
        }
    }
    return hash >>> 0; //cast to u32
}
globalThis.cacheFilenameHash = cacheFilenameHash;
function stringToMapArea(str) {
    let [x, z, xsize, zsize] = str.split(/[,\.\/:;]/).map(n => +n);
    xsize = xsize ?? 1;
    zsize = zsize ?? xsize;
    if (isNaN(x) || isNaN(z) || isNaN(xsize) || isNaN(zsize)) {
        return null;
    }
    return { x, z, xsize, zsize };
}
function stringToFileRange(str) {
    let parts = str.split(",");
    let ranges = parts.map(q => {
        let ends = q.split("-");
        let start = ends[0] ? ends[0].split(".") : [];
        let end = (ends[0] || ends[1]) ? (ends[1] ?? ends[0]).split(".") : [];
        return {
            start: [+(start[0] ?? 0), +(start[1] ?? 0), +(start[2] ?? 0)],
            end: [+(end[0] ?? Infinity), +(end[1] ?? Infinity), +(end[2] ?? Infinity)]
        };
    });
    return ranges;
}
//weird generics on fallback to force ts to use the stricter type provided by map
function getOrInsert(map, key, fallback) {
    let val = map.get(key);
    if (val === undefined) {
        val = fallback();
        map.set(key, val);
    }
    return val;
}
function delay(ms) {
    return new Promise(d => setTimeout(d, ms));
}
function posmod(x, n) {
    return ((x % n) + n) % n;
}
function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function rsmarkupToSafeHtml(str) {
    let res = "";
    let tokenstack = [];
    try {
        while (str) {
            let token = str.match(/<(\/?)(\w+)(=(\w+))?>/);
            if (!token) {
                res += escapeHTML(str);
                str = "";
            }
            else {
                res += escapeHTML(str.slice(0, token.index));
                str = str.slice(token.index + token[0].length);
                let isclose = !!token[1];
                let tagname = token[2];
                if (isclose) {
                    let last = tokenstack.pop();
                    if (last != tagname) {
                        throw new Error("markup token mismatch");
                    }
                    if (last == "col") {
                        res += "</span>";
                    }
                    else {
                        throw new Error("unknown markup closing token " + last);
                    }
                }
                else if (tagname == "br") {
                    res += "<br/>";
                }
                else if (tagname == "col") {
                    res += `<span style="color:#${token[4].replace(/\W/g, "")};">`;
                    tokenstack.push("col");
                }
                else {
                    throw new Error("unknown token " + tagname);
                }
            }
        }
        while (tokenstack.length != 0) {
            let token = tokenstack.pop();
            if (token == "col") {
                res += "</span>";
            }
            else {
                throw new Error("non-autocloseable token left unclosed " + token);
            }
        }
    }
    catch (e) {
        console.log(e.message);
        res = escapeHTML(str);
    }
    return res;
}
/**
 * used to get an array with enum typing
 */
function arrayEnum(v) {
    return v;
}
/**
 * Used to provide literal typing of map keys while also constraining each value
 */
function constrainedMap() {
    return function (v) {
        return v;
    };
}
exports.Stream = function Stream(data, scan = 0) {
    // Double check the mime type
    /*if (data[data.length - 4] != 0x4F) // O
        return null;
    else if (data[data.length - 3] != 0x42) // B
        return null;
    else if (data[data.length - 2] != 0x58) // X
        return null;
    else if (data[data.length - 1] != 0x33) // 3
        return null;*/
    this.getData = function () {
        return data;
    };
    this.bytesLeft = function () {
        return data.length - scan;
    };
    this.readBuffer = function (len = data.length - scan) {
        let res = data.slice(scan, scan + len);
        scan += len;
        return res;
    };
    this.tee = function () {
        return new Stream(data, scan);
    };
    this.eof = function () {
        if (scan > data.length) {
            throw new Error("reading past end of buffer");
        }
        return scan >= data.length;
    };
    this.skip = function (n) {
        scan += n;
        return this;
    };
    this.scanloc = function () {
        return scan;
    };
    this.readByte = function () {
        var val = this.readUByte();
        if (val > 127)
            return val - 256;
        return val;
    };
    this.readUShortSmart = function () {
        let byte0 = this.readUByte();
        if ((byte0 & 0x80) == 0) {
            return byte0;
        }
        let byte1 = this.readUByte();
        return ((byte0 & 0x7f) << 8) | byte1;
    };
    this.readShortSmart = function () {
        let byte0 = this.readUByte();
        let byte0val = byte0 & 0x7f;
        byte0val = (byte0 < 0x40 ? byte0 : byte0 - 0x80);
        if ((byte0 & 0x80) == 0) {
            return byte0val;
        }
        let byte1 = this.readUByte();
        return (byte0val << 8) | byte1;
    };
    this.readShortSmartBias = function () {
        let byte0 = this.readUByte();
        if ((byte0 & 0x80) == 0) {
            return byte0 - 0x40;
        }
        let byte1 = this.readUByte();
        return (((byte0 & 0x7f) << 8) | byte1) - 0x4000;
    };
    this.readUIntSmart = function () {
        let byte0 = this.readUByte();
        let byte1 = this.readUByte();
        if ((byte0 & 0x80) == 0) {
            return (byte0 << 8) | byte1;
        }
        let byte2 = this.readUByte();
        let byte3 = this.readUByte();
        return ((byte0 & 0x7f) << 24) | (byte1 << 16) | (byte2 << 8) | byte3;
    };
    this.readUByte = function () {
        return data[scan++];
    };
    this.readShort = function (bigendian = false) {
        var val = this.readUShort(bigendian);
        if (val > 32767)
            return val - 65536;
        return val;
    };
    this.readTribyte = function () {
        let val = data.readIntBE(scan, 3);
        scan += 3;
        return val;
    };
    this.readUShort = function (bigendian = false) {
        if (bigendian)
            return ((data[scan++] << 8) & 0xFF00) | data[scan++];
        else
            return data[scan++] | ((data[scan++] << 8) & 0xFF00);
    };
    this.readUInt = function (bigendian = false) {
        if (bigendian)
            return (((data[scan++] << 24) & 0xFF000000) | ((data[scan++] << 16) & 0xFF0000) | ((data[scan++] << 8) & 0xFF00) | data[scan++]) >>> 0;
        else
            return (data[scan++] | ((data[scan++] << 8) & 0xFF00) | ((data[scan++] << 16) & 0xFF0000) | ((data[scan++] << 24) & 0xFF000000)) >>> 0;
    };
    this.readFloat = function (bigendian = false, signage = false) {
        var upper, mid, lower, exponent;
        if (bigendian) {
            exponent = data[scan++];
            lower = (data[scan++] << 16) & 0xFF0000;
            mid = (data[scan++] << 8) & 0xFF00;
            upper = data[scan++];
        }
        else {
            upper = data[scan++];
            mid = (data[scan++] << 8) & 0xFF00;
            lower = (data[scan++] << 16) & 0xFF0000;
            exponent = data[scan++];
        }
        var mantissa = upper | mid | lower;
        if (signage) {
            //console.log(exponent.toString(16), mantissa.toString(16));
            exponent = (exponent << 1) & 0xFE;
            if ((mantissa & 0x800000) == 0x800000)
                exponent |= 0x1;
            mantissa &= 0x7FFFFF;
            //console.log(exponent.toString(16), mantissa.toString(16));
        }
        return (1.0 + mantissa * Math.pow(2.0, signage ? -23.0 : -24.0)) * Math.pow(2.0, exponent - 127.0);
    };
    this.readHalf = function (flip = false) {
        //TODO flip isn't even implemented?
        var upper = data[scan++];
        var lower = data[scan++];
        var mantissa = lower | ((upper << 8) & 0x0300);
        var exponent = (upper >> 2) & 0x1F;
        mantissa = mantissa * Math.pow(2.0, -10.0) + (exponent == 0 ? 0.0 : 1.0);
        mantissa *= Math.pow(2.0, exponent - 15.0);
        if ((upper & 0x80) == 0x80)
            mantissa *= -1.0;
        return mantissa;
    };
    /*var scan = data.length - 12;
    var imageScan = 0;
    var metadataScan = this.readInt();
    var modelScan = this.readInt();
    scan = modelScan;*/
};
function flipEndian16(u16) {
    return ((u16 & 0xff) << 8) | ((u16 & 0xff00) >>> 8);
}
//2 bytes interpreted as u16 BE to float16 LE
function ushortToHalf(bytes) {
    bytes = flipEndian16(bytes);
    let positive = (bytes & 0x8000) == 0;
    let exponent = (bytes & 0x7c00) >> 10;
    let mantissa = (bytes & 0x03ff);
    let res = mantissa * Math.pow(2.0, -10.0) + (exponent == 0 ? 0.0 : 1.0);
    res *= Math.pow(2.0, exponent - 15.0);
    if (positive) {
        return res;
    }
    return -res;
}
// https://stackoverflow.com/a/9493060
function HSL2RGBfloat(hsl) {
    var h = hsl[0];
    var s = hsl[1];
    var l = hsl[2];
    var r, g, b;
    if (s == 0) {
        r = g = b = l; // achromatic
    }
    else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b];
}
// https://stackoverflow.com/a/9493060
function HSL2RGB(hsl) {
    let rgb = HSL2RGBfloat(hsl);
    return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
}
function RGB2HSL(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    let l = (max + min) / 2;
    if (max != min) {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }
    return [h, s, l];
}
globalThis.hsl = (v) => HSL2RGB(packedHSL2HSL(v));
function HSL2packHSL(h, s, l) {
    if (h < 0) {
        h += 1;
    }
    return (Math.round(h * 63) << 10) | (Math.round(s * 7) << 7) | (Math.round(l * 127));
}
function packedHSL2HSL(hsl) {
    var h = ((hsl >> 10) & 0x3F) / 63.0;
    var s = ((hsl >> 7) & 0x7) / 7.0;
    var l = (hsl & 0x7F) / 127.0;
    if (h > 0.5)
        h = h - 1.0;
    return [h, s, l];
}
class TypedEmitter {
    listeners = {};
    on(event, listener) {
        let listeners = this.listeners[event] ?? (this.listeners[event] = new Set());
        listeners.add(listener);
    }
    once(event, listener) {
        let listeners = this.listeners[event] ?? (this.listeners[event] = new Set());
        let oncer = (v) => {
            listeners.delete(oncer);
            listener(v);
        };
        listeners.add(oncer);
    }
    off(event, listener) {
        let listeners = this.listeners[event] ?? (this.listeners[event] = new Set());
        listeners.delete(listener);
    }
    emit(event, value) {
        let listeners = this.listeners[event] ?? (this.listeners[event] = new Set());
        listeners.forEach(cb => cb(value));
    }
}
exports.TypedEmitter = TypedEmitter;
//same as the new Promise.WithResolvers built-in (late 2023)
class CallbackPromise extends Promise {
    done;
    err;
    constructor(exe = (done, err) => { }) {
        //tmp vars since i can't access this during the super callback
        let tmpdone;
        let tmperr;
        super((done, err) => { tmpdone = done; tmperr = err; return exe(done, err); });
        this.done = tmpdone;
        this.err = tmperr;
    }
}
exports.CallbackPromise = CallbackPromise;
//runs at most [parallel] async tasks at the same time
function trickleTasks(name, parallel, tasks) {
    let len = (Array.isArray(tasks) ? tasks.length : -1);
    if (name) {
        console.log(`starting ${name}, ${len == -1 ? "??" : len} tasks`);
    }
    if (typeof tasks == "function") {
        tasks = tasks();
    }
    let iter = tasks[Symbol.iterator]();
    return new Promise(done => {
        let index = 0;
        let running = 0;
        let run = () => {
            let next = iter.next();
            if (!next.done) {
                next.value.finally(run);
                if (index % 100 == 0 && name) {
                    console.log(`${name} progress ${index}/${len == -1 ? "" : len}`);
                }
            }
            else {
                running--;
                if (running <= 0) {
                    if (name) {
                        console.log(`completed ${name}`);
                    }
                    done();
                }
            }
        };
        for (let i = 0; i < parallel; i++) {
            running++;
            run();
        }
    });
}
//the second callback is guaranteed to be called in the same order as the tasks were queued
async function trickleTasksTwoStep(parallel, tasks, steptwo) {
    let writecounter = 0;
    let completecounter = 0;
    let queue = new Array(parallel).fill(null);
    for (let prom of tasks()) {
        let index = writecounter++;
        queue[index % parallel] = prom;
        if (writecounter >= completecounter + parallel) {
            if (writecounter >= parallel) {
                let res = await queue[completecounter % parallel];
                completecounter++;
                steptwo(res);
            }
        }
    }
    while (completecounter < writecounter) {
        let res = await queue[completecounter % parallel];
        completecounter++;
        steptwo(res);
    }
}
class FetchThrottler {
    reqQueue = [];
    activeReqs = 0;
    maxParallelReqs;
    constructor(maxParallelReqs) {
        this.maxParallelReqs = maxParallelReqs;
    }
    //prevent overloading the server by using to many parallel requests
    async apiRequest(url, init, retrycount = 5, retrydelay = 1000) {
        if (this.activeReqs >= this.maxParallelReqs) {
            let prom = new CallbackPromise();
            this.reqQueue.push(prom.done);
            await prom;
        }
        this.activeReqs++;
        let res = null;
        try {
            //TODO get right typescript lib version for abortsignal.timeout
            res = await fetch(url, { signal: AbortSignal.timeout(init?.timeout ?? 1000 * 60), ...init });
        }
        catch (e) {
            //handled later
        }
        finally {
            this.activeReqs--;
            let stalled = this.reqQueue.shift();
            stalled?.();
        }
        if (!res || res.status == 503 || res.status == 429) {
            let retryheader = res?.headers.get("retry-after");
            let delaytime = retryheader && !isNaN(+retryheader) ? +retryheader : retrydelay;
            await delay(delaytime);
            return this.apiRequest(url, init, retrycount - 1, delaytime * 2);
        }
        return res;
    }
}
exports.FetchThrottler = FetchThrottler;
class IterableWeakMap {
    weakMap = new WeakMap();
    refSet = new Set();
    finalizationGroup = new FinalizationRegistry(IterableWeakMap.cleanup);
    static cleanup({ set, ref }) {
        set.delete(ref);
    }
    constructor() {
    }
    set(key, value) {
        const ref = new WeakRef(key);
        let prev = this.weakMap.get(key);
        if (prev) {
            this.refSet.delete(prev.ref);
        }
        this.weakMap.set(key, { value, ref });
        this.refSet.add(ref);
        this.finalizationGroup.register(key, {
            set: this.refSet,
            ref
        }, ref);
    }
    get(key) {
        const entry = this.weakMap.get(key);
        return entry && entry.value;
    }
    getOrInsert(key, data) {
        let entry = this.weakMap.get(key);
        if (entry) {
            return entry.value;
        }
        let val = data();
        this.set(key, val);
        return val;
    }
    delete(key) {
        const entry = this.weakMap.get(key);
        if (!entry) {
            return false;
        }
        this.weakMap.delete(key);
        this.refSet.delete(entry.ref);
        this.finalizationGroup.unregister(entry.ref);
        return true;
    }
    *[Symbol.iterator]() {
        for (const ref of this.refSet) {
            const key = ref.deref();
            if (!key)
                continue;
            const { value } = this.weakMap.get(key);
            yield [key, value];
        }
    }
    entries() {
        return this[Symbol.iterator]();
    }
    *keys() {
        for (const [key, value] of this) {
            yield key;
        }
    }
    *values() {
        for (const [key, value] of this) {
            yield value;
        }
    }
}
exports.IterableWeakMap = IterableWeakMap;
class WeakRefMap {
    map = new Map();
    registry = new FinalizationRegistry(k => this.map.delete(k));
    set(key, value) {
        let prev = this.map.get(key)?.deref();
        if (prev) {
            this.registry.unregister(prev);
        }
        this.map.set(key, new WeakRef(value));
        this.registry.register(value, key);
    }
    delete(key) {
        let prev = this.map.get(key)?.deref();
        if (prev) {
            this.map.delete(key);
            this.registry.unregister(prev);
        }
    }
    get(key) {
        return this.map.get(key)?.deref();
    }
    getOrDefault(key, create) {
        let v = this.map.get(key)?.deref();
        if (!v) {
            v = create();
            this.set(key, v);
        }
        return v;
    }
    *keys() {
        yield* this.map.keys();
    }
    *values() {
        for (const [k, v] of this) {
            yield v;
        }
    }
    *[Symbol.iterator]() {
        for (const [k, ref] of this.map) {
            const v = ref.deref();
            if (!v)
                continue;
            yield [k, v];
        }
    }
}
exports.WeakRefMap = WeakRefMap;
function findParentElement(el, cond, fallback = null) {
    while (el) {
        if (cond(el)) {
            return el;
        }
        el = el.parentElement;
    }
    return fallback;
}
