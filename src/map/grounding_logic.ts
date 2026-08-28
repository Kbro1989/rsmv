export interface VarbitDefinition {
	varid: number;
	bits: [number, number];
}

export interface MapZoneBounds {
	plane: number;
	src: { xstart: number, zstart: number, xend: number, zend: number };
	dst: { xstart: number, zstart: number, xend: number, zend: number };
}

export interface MapZoneDefinition {
	internal_name: string;
	name: string;
	center: number;
	unpackedCenter: { x: number, z: number, plane: number };
	bounds: MapZoneBounds[];
}

export class SovereignGrounding {
	varbits: Record<number, VarbitDefinition> = {};
	mapzones: Record<number, MapZoneDefinition> = {};
	synthesis: Record<number, { npcs: number[], objects: number[] }> = {};

	// Full Pedagogy Datasets for Interaction & POG2 Agent Runtime
	pedagogy: {
		enums: any;
		dbtables: any;
		materials: any;
		quests: any;
		equipment_by_slot: any;
		objects: any;
		items: any;
		npcs: any;
	} = { enums: {}, dbtables: {}, materials: {}, quests: {}, equipment_by_slot: {}, objects: {}, items: {}, npcs: {} };

	constructor(
		varbits: Record<number, VarbitDefinition> = {}, 
		mapzones: Record<number, MapZoneDefinition> = {}, 
		synthesis: Record<number, { npcs: number[], objects: number[] }> = {},
		pedagogy: any = {}
	) {
		this.varbits = varbits;
		this.mapzones = mapzones;
		this.synthesis = synthesis;
		if (Object.keys(pedagogy).length > 0) {
			this.pedagogy = pedagogy as any;
		}
	}

	findMapZone(x: number, z: number, plane: number): MapZoneDefinition | null {
		for (const zone of Object.values(this.mapzones)) {
			for (const bound of zone.bounds) {
				if (bound.plane === plane &&
					x >= bound.src.xstart && x <= bound.src.xend &&
					z >= bound.src.zstart && z <= bound.src.zend) {
					return zone;
				}
			}
		}
		return null;
	}

	getVarbitsForBaseVar(baseVarId: number): Record<number, VarbitDefinition> {
		const results: Record<number, VarbitDefinition> = {};
		for (const [id, def] of Object.entries(this.varbits)) {
			if (def.varid === baseVarId) {
				results[+id] = def;
			}
		}
		return results;
	}

	getEntitiesForVarbit(varbitId: number): { npcs: number[], objects: number[] } {
		return this.synthesis[varbitId] || { npcs: [], objects: [] };
	}

	getRegionMetadata(x: number, z: number, plane: number = 0) {
		const zone = this.findMapZone(x, z, plane);
		if (!zone) return { id: -1, name: "Unknown Territory", archetype: "Wilderness" };
		
		return {
			id: zone.center,
			name: zone.name,
			archetype: zone.internal_name,
			varbits: [] // TODO: Collect varbits relevant to this zone
		};
	}

	static async loadDefault(): Promise<SovereignGrounding> {
		const fs = require("fs");
		const path = require("path");
		const ROOT = "D:\\sovereign\\memory\\pedagogy";
		
		const load = (file: string) => {
			const p = path.join(ROOT, file);
			return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
		};

		const JSON_DUMPS_ROOT = "D:\\sovereign\\cache_pedagogy\\json_dumps";
		const loadPedagogyDump = (file: string) => {
			const p = path.join(JSON_DUMPS_ROOT, file);
			return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
		}

		console.log("Loading Varbits & Mapzones...");
		const varbits = load("varbits_registry.json");
		const mapzones = load("mapzones_registry.json");
		const synthesis = load("taxonomic_synthesis.json");

		console.log("Hydrating Pedagogy Datasets for Sovereign Run-Time...");
		const pedagogy = {
			enums: loadPedagogyDump("enums.json"),
			dbtables: loadPedagogyDump("dbtables.json"),
			materials: loadPedagogyDump("materials.json"),
			quests: loadPedagogyDump("quests.json"),
			equipment_by_slot: loadPedagogyDump("equipment_by_slot.json"),
			objects: loadPedagogyDump("objects.json"),
			items: loadPedagogyDump("items.json"),
			npcs: loadPedagogyDump("npcs.json")
		};
		console.log("Pedagogy Hydration complete.");

		return new SovereignGrounding(varbits, mapzones, synthesis, pedagogy);
	}

	/**
	 * Unpacks a coordinate from Jagex packed format (used in Map Zones)
	 * Typically: plane << 28 | x << 14 | z
	 */
	static unpackCoord(packed: number) {
		return {
			plane: (packed >>> 28),
			x: (packed >>> 14) & 0x3FFF,
			z: (packed & 0x3FFF)
		};
	}
}
