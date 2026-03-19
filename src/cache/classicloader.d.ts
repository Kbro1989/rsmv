import { CacheFileSource, CacheIndex, SubFile } from ".";
import { ScriptFS } from "../scriptrunner";
export declare const classicGroups: {
    readonly textures: 6;
    readonly models: 101;
    readonly entity: 102;
    readonly maps: 103;
    readonly land: 104;
    readonly filter: 105;
    readonly jagex: 106;
    readonly media: 107;
    readonly sounds: 108;
    readonly config: 110;
};
type CacheVersion = {
    config: number;
    maps: number;
    land: number;
    media: number;
    models: number;
    textures: number;
    entity: number;
    sounds: number;
    filter: number;
};
type CacheBuildInfo = {
    name: string;
    buildnr: number;
    locsjson: string | null;
    versions: CacheVersion;
    date: Date;
};
type DetectedVersion = {
    buildnr: number;
    locsjson: string | null;
    iscomplete: boolean;
    target: CacheVersion;
    foundjag: CacheVersion;
    foundmem: CacheVersion;
};
type ExternalLocJson = {
    id: number;
    dir: number;
    x: number;
    z: number;
    level: number;
};
export declare const classicBuilds: CacheBuildInfo[];
export declare function detectClassicVersions(filenames: string[]): DetectedVersion[];
export declare class ClassicFileSource extends CacheFileSource {
    usingversion: DetectedVersion;
    fs: ScriptFS;
    constructor(fs: ScriptFS, version: DetectedVersion);
    static create(files: ScriptFS, version?: DetectedVersion): Promise<ClassicFileSource>;
    getFileArchive(meta: CacheIndex): Promise<SubFile[]>;
    getNamedFile(name: keyof typeof classicGroups, mem: boolean): Promise<Buffer<ArrayBufferLike> | null>;
    getBuildNr(): number;
    getCacheMeta(): {
        name: string;
        descr: string;
        timestamp: Date;
    };
    getFile(major: number, minor: number): Promise<Buffer>;
}
export type ClassicConfig = Awaited<ReturnType<typeof classicConfig>>;
export declare function classicConfig(source: ClassicFileSource, buildnr: number): Promise<{
    items: {
        name: string;
        examine: string;
        command: string;
        sprite: number;
        price: number;
        stackable: boolean;
        special: boolean;
        equip: number;
        color: number;
        untradeable: boolean;
        member: boolean;
    }[];
    npcs: {
        name: string;
        examine: string;
        command: string;
        attack: number;
        strength: number;
        hits: number;
        defence: number;
        hostility: number;
        anims: number[];
        haircolor: number;
        topcolor: number;
        bottomcolor: number;
        skincolor: number;
        width: number;
        height: number;
        walkmodel: number;
        combatmodel: number;
        combatanim: number;
    }[];
    textures: {
        name: string;
        subname: string;
    }[];
    anims: {
        name: string;
        color: number;
        gendermodel: number;
        has_a: boolean;
        has_f: boolean;
        unk: number;
    }[];
    objects: {
        name: string;
        examine: string;
        command_0: string;
        command_1: string;
        model: {
            name: string;
            id: number | undefined;
        };
        xsize: number;
        zsize: number;
        type: number;
        item_height: number;
    }[];
    wallobjects: {
        name: string;
        examine: string;
        command_0: string;
        command_1: string;
        height: number;
        frontdecor: number;
        backdecor: number;
        blocked: boolean;
        invisible: boolean;
    }[];
    roofs: {
        height: number;
        texture: number;
    }[];
    tiles: {
        decor: number;
        type: {
            type: number;
            autoconnect: boolean;
            indoors: boolean;
            iswater: boolean;
            bridge: boolean;
        };
        blocked: boolean;
    }[];
    projectile: Record<string, any>[];
    spells: {
        name: string;
        examine: string;
        level: number;
        num_runes: number;
        type: number;
        runetypes: number[];
        runeamounts: number[];
    }[];
    prayers: {
        name: string;
        examine: string;
        level: number;
        drain: number;
    }[];
    jsonlocs: ExternalLocJson[];
}>;
export {};
