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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PEDAGOGY_ROOT = "D:\\sovereign\\memory\\pedagogy";
const VARBITS_DIR = path.join(PEDAGOGY_ROOT, "varbits_json");
const MAPZONES_DIR = path.join(PEDAGOGY_ROOT, "mapzones_json");
async function generateRegistries() {
    console.log("Starting Sovereign Pedagogy Registry Generation...");
    // 1. Varbit Registry
    console.log(`Scanning varbits in ${VARBITS_DIR}...`);
    const varbitFiles = fs.readdirSync(VARBITS_DIR).filter(f => f.startsWith("varbits-") && f.endsWith(".json"));
    const varbitRegistry = {};
    for (const file of varbitFiles) {
        const id = parseInt(file.match(/varbits-(\d+)\.json/)?.[1] ?? "-1");
        if (id === -1)
            continue;
        const content = JSON.parse(fs.readFileSync(path.join(VARBITS_DIR, file), "utf-8"));
        varbitRegistry[id] = {
            varid: content.varid,
            bits: content.bits
        };
    }
    const varbitOut = path.join(PEDAGOGY_ROOT, "varbits_registry.json");
    fs.writeFileSync(varbitOut, JSON.stringify(varbitRegistry, null, "\t"));
    console.log(`Saved ${Object.keys(varbitRegistry).length} varbits to ${varbitOut}`);
    // 2. Map Zone Registry
    console.log(`Scanning mapzones in ${MAPZONES_DIR}...`);
    const zoneFiles = fs.readdirSync(MAPZONES_DIR).filter(f => f.startsWith("mapzones-") && f.endsWith(".json"));
    const zoneRegistry = {};
    for (const file of zoneFiles) {
        const id = parseInt(file.match(/mapzones-(\d+)\.json/)?.[1] ?? "-1");
        if (id === -1)
            continue;
        const content = JSON.parse(fs.readFileSync(path.join(MAPZONES_DIR, file), "utf-8"));
        // Unpack coordinate center for spatial queries
        const centerPacked = content.center;
        const plane = (centerPacked >>> 28);
        const x = (centerPacked >>> 14) & 0x3FFF;
        const z = (centerPacked & 0x3FFF);
        zoneRegistry[id] = {
            ...content,
            unpackedCenter: { x, z, plane }
        };
    }
    const zoneOut = path.join(PEDAGOGY_ROOT, "mapzones_registry.json");
    fs.writeFileSync(zoneOut, JSON.stringify(zoneRegistry, null, "\t"));
    console.log(`Saved ${Object.keys(zoneRegistry).length} mapzones to ${zoneOut}`);
    console.log("Sovereign Grounding Registries Complete.");
}
generateRegistries().catch(err => {
    console.error("Failed to generate registries:", err);
    process.exit(1);
});
