"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maprenderConfigSchema = exports.scenarioStateSchema = exports.customModelDefSchema = void 0;
exports.assertSchema = assertSchema;
exports.parseJsonOrDefault = parseJsonOrDefault;
const json_schema_1 = require("json-schema");
function assertSchema(v, schema) {
    (0, json_schema_1.mustBeValid)((0, json_schema_1.validate)(v, schema));
}
function parseJsonOrDefault(str, schema, defaultvalue) {
    try {
        if (typeof str != "string") {
            throw new Error("json string expected");
        }
        let v = JSON.parse(str);
        assertSchema(v, schema);
        return v;
    }
    catch {
        return (typeof defaultvalue == "function" ? defaultvalue() : defaultvalue);
    }
}
const int = { type: "integer" };
const number = { type: "number" };
const string = { type: "string" };
const boolean = { type: "boolean" };
const mapRectSchema = {
    properties: {
        x: int,
        z: int,
        xsize: int,
        zsize: int
    },
    required: ["x", "z", "xsize", "zsize"]
};
const modelModsSchema = {
    properties: {
        replaceMaterials: { type: "array", minLength: 2, maxLength: 2, items: int },
        replaceColors: { type: "array", minLength: 2, maxLength: 2, items: int }
    }
};
const simpleModelDefSchema = {
    type: "array",
    items: {
        properties: {
            modelid: int,
            mods: modelModsSchema,
        },
        required: ["modelid", "mods"]
    }
};
exports.customModelDefSchema = {
    properties: {
        type: { const: "custom" },
        modelkey: string,
        name: string,
        simpleModel: simpleModelDefSchema,
        globalMods: modelModsSchema,
        basecomp: string
    },
    required: ["type", "modelkey", "name", "simplemodel", "globalMods", "basecomp"]
};
const scenarioModelSchema = {
    oneOf: [
        {
            properties: {
                type: { const: "simple" },
                modelkey: string,
                name: string,
                simpleModel: simpleModelDefSchema
            },
            required: ["type", "modelkey", "name", "simplemodel"]
        },
        {
            properties: {
                type: { const: "map" },
                modelkey: string,
                name: string,
                mapRect: mapRectSchema
            },
            required: ["type", "modelkey", "name", "mapRect"]
        },
        exports.customModelDefSchema
    ]
};
const scenarioActionSchema = {
    oneOf: [
        {
            properties: {
                type: { const: "location" },
                target: int,
                x: number,
                z: number,
                level: int,
                dy: number,
                rotation: number,
            },
            required: ["type", "target", "x", "z", "level", "dy"]
        },
        {
            properties: {
                type: { const: "transform" },
                target: int,
                flip: boolean,
                scalex: number,
                scaley: number,
                scalez: number
            },
            required: ["type", "target", "flip", "scalex", "scaley", "scalez"]
        },
        {
            properties: {
                type: { const: "anim" },
                target: int,
                animid: int
            },
            required: ["type", "target", "animid"]
        },
        {
            properties: {
                type: { const: "animset" },
                target: int,
                animid: int,
                anims: {
                    type: "object",
                    additionalProperties: int
                }
            },
            required: ["type", "target", "animid", "anims"]
        },
        {
            properties: {
                type: { const: "delay" },
                target: { const: -1 },
                duration: number
            },
            required: ["type", "target", "duration"]
        },
        {
            properties: {
                type: { const: "visibility" },
                target: int,
                visibility: boolean
            },
            required: ["type", "target", "visibility"]
        },
        {
            properties: {
                type: { const: "scale" },
                target: int,
                scalex: number,
                scaley: number,
                scalez: number
            },
            required: ["type", "target", "scalex", "scaley", "scalez"]
        }
    ]
};
exports.scenarioStateSchema = {
    properties: {
        components: {
            type: "object",
            additionalProperties: scenarioModelSchema
        },
        actions: {
            type: "array",
            items: scenarioActionSchema
        }
    }
};
exports.maprenderConfigSchema = {
    properties: {
        tileimgsize: number,
        mapsizex: number,
        mapsizez: number,
        area: {
            default: "full",
            description: "A string representing the the map area to render. Either one of the named presets (main, full, test ...), or one or more chunk ranges. eg: 50.50,20.20-70.70",
            anyOf: [
                { type: "string", pattern: /^\d+\.\d+(-\d+\.\d+)?(,\d+\.\d+(-\d+\.\d+)?)*$/.source },
                { type: "string", enum: ["main", "full", "test"] },
                { type: "string", pattern: /^\w+$/.source },
            ]
        },
        noyflip: {
            type: "boolean",
            default: false,
            description: "Set to true to keep the output y origin at the bottom left, equal to the game z origin."
        },
        nochunkoffset: {
            type: "boolean",
            default: false,
            description: "Set to true to keep output chunks aligned with in-game chunks. Incurs performance penalty as more neighbouring chunks have to be loaded."
        },
        layers: {
            items: {
                properties: {
                    mode: string,
                    pxpersquare: number,
                    name: string,
                    level: number,
                    usegzip: boolean,
                    subtractlayers: { items: string },
                    format: { type: "string", enum: ["png", "webp"] },
                    mipmode: { enum: ["default", "avg"] }
                },
                required: ["mode", "name", "pxpersquare", "level"],
                oneOf: [{
                        properties: {
                            mode: { enum: ["3d", "minimap", "interactions"] },
                            dxdy: number,
                            dzdy: number,
                            hidelocs: boolean,
                            overlaywalls: boolean,
                            overlayicons: boolean
                        },
                        required: ["mode", "dxdy", "dzdy"]
                    }, {
                        properties: {
                            mode: { const: "map" },
                            wallsonly: boolean,
                            mapicons: boolean,
                            thicklines: boolean
                        },
                        required: ["mode"]
                    }, {
                        properties: {
                            mode: { enum: ["height", "collision", "locs", "maplabels", "rendermeta"] }
                        },
                        required: ["mode"]
                    }]
            }
        }
    },
    required: ["layers", "tileimgsize", "mapsizex", "mapsizez", "area"]
};
