"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachingFileSource = void 0;
const _1 = require(".");
const constants_1 = require("../constants");
class CachingFileSource extends _1.CacheFileSource {
    archieveCache = new Map();
    cachedObjects = [];
    cacheFetchCounter = 0;
    cacheAddCounter = 0;
    maxcachesize = 200e6;
    rawsource;
    constructor(base) {
        super();
        this.rawsource = base;
    }
    fetchCachedObject(map, id, create, getSize) {
        let bucket = map.get(id);
        if (!bucket || globalThis.ignoreCache) {
            let data = create();
            bucket = {
                promise: data,
                data: null,
                owner: map,
                id: id,
                lastuse: 0,
                size: 0,
                usecount: 0
            };
            data.then(obj => {
                bucket.size = getSize(obj);
                //delete the promise since otherwise v8 leaks the internal callback list
                //not sure why (chromium 110.0.5481.179, electron 23.1.3)
                bucket.promise = null;
                bucket.data = obj;
            });
            this.cachedObjects.push(bucket);
            map.set(id, bucket);
            if (++this.cacheAddCounter % 100 == 0) {
                this.sweepCachedObjects();
            }
        }
        bucket.usecount++;
        bucket.lastuse = this.cacheFetchCounter++;
        if (bucket.data) {
            //create a new promise here to prevent memory leak in v8, somehow adding new callback to a resolved promise
            //results in the promise holding a reference to all of them indefinitely
            return Promise.resolve(bucket.data);
        }
        else {
            return bucket.promise;
        }
    }
    sweepCachedObjects() {
        let score = (bucket) => {
            //less is better
            return (
            //up to 100 penalty for not being used recently
            Math.min(100, this.cacheFetchCounter - bucket.lastuse)
                //up to 100 score for being used often
                + Math.max(-100, -bucket.usecount * 10));
        };
        this.cachedObjects.sort((a, b) => score(a) - score(b));
        let newlength = this.cachedObjects.length;
        let totalsize = 0;
        for (let i = 0; i < this.cachedObjects.length; i++) {
            let bucket = this.cachedObjects[i];
            totalsize += bucket.size;
            if (totalsize > this.maxcachesize) {
                newlength = Math.min(newlength, i);
                bucket.owner.delete(bucket.id);
            }
            else {
                bucket.usecount = 0;
            }
        }
        // console.log("scenecache sweep completed, removed", this.cachedObjects.length - newlength, "of", this.cachedObjects.length, "objects");
        // console.log("old totalsize", totalsize);
        this.cachedObjects.length = newlength;
    }
    getCacheIndex(major) {
        return this.rawsource.getCacheIndex(major);
    }
    getFile(major, minor, crc) {
        return this.rawsource.getFile(major, minor, crc);
    }
    getFileArchive(index) {
        let get = () => this.rawsource.getFileArchive(index);
        //don't attempt to cache large files that have their own cache
        if (index.major == constants_1.cacheMajors.models || index.major == constants_1.cacheMajors.texturesBmp || index.major == constants_1.cacheMajors.texturesDds || index.major == constants_1.cacheMajors.texturesPng) {
            return get();
        }
        else {
            let cachekey = (index.major << 23) | index.minor; //23bit so it still fits in a 31bit smi
            return this.fetchCachedObject(this.archieveCache, cachekey, get, obj => obj.reduce((a, v) => a + v.size, 0));
        }
    }
    getBuildNr() {
        return this.rawsource.getBuildNr();
    }
    getCacheMeta() {
        return this.rawsource.getCacheMeta();
    }
}
exports.CachingFileSource = CachingFileSource;
