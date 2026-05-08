import { JSONSchema6 } from "json-schema";
export declare function assertSchema(v: unknown, schema: JSONSchema6): void;
export declare function parseJsonOrDefault<T extends number | string | object | boolean>(str: unknown, schema: JSONSchema6, defaultvalue: (T | (() => T))): T;
export declare const customModelDefSchema: {
    properties: {
        type: {
            const: string;
        };
        modelkey: JSONSchema6;
        name: JSONSchema6;
        simpleModel: JSONSchema6;
        globalMods: JSONSchema6;
        basecomp: JSONSchema6;
    };
    required: string[];
};
export declare const scenarioStateSchema: JSONSchema6;
export declare const maprenderConfigSchema: JSONSchema6;
