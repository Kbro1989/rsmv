import * as fs from "fs";
import * as path from "path";
import { GameCacheLoader } from "../cache/sqlite";
import { parse } from "../opdecoder";
import { cacheMajors } from "../constants";
import { archiveToFileId } from "../cache";

const PEDAGOGY_ROOT = "D:\\sovereign\\memory\\pedagogy";
const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function extractTaxonomic() {
	console.log("Starting Triple-Source Sovereign Taxonomic Synthesis...");
	
	if (!fs.existsSync(CACHE_DIR)) {
		console.error(`Cache database not found at ${CACHE_DIR}`);
		process.exit(1);
	}

	const source = new GameCacheLoader(CACHE_DIR);
	
	const varbitRegistryPath = path.join(PEDAGOGY_ROOT, "varbits_registry.json");
	if (!fs.existsSync(varbitRegistryPath)) {
		console.error("Varbit registry not found. Run generate_pedagogy_registries.ts first.");
		process.exit(1);
	}
	const varbitRegistry = JSON.parse(fs.readFileSync(varbitRegistryPath, "utf-8"));
	
	const synthesis = {
		varbits: {} as Record<number, { npcs: number[], objects: number[] }>,
		varps: {} as Record<number, { npcs: number[], objects: number[] }>,
		materials: {} as Record<number, { version: number, flags: string[] }>
	};

	const addTrigger = (id: number, type: 'npcs' | 'objects', triggerType: 'varbits' | 'varps', entityId: number) => {
		if (id === -1 || id === 65535) return;
		if (!synthesis[triggerType][id]) synthesis[triggerType][id] = { npcs: [], objects: [] };
		if (!synthesis[triggerType][id][type].includes(entityId)) {
			synthesis[triggerType][id][type].push(entityId);
		}
	};

	// 1. Scan NPCs (Major 18)
	console.log("Scanning NPCs (Major 18) for Morph Pointers...");
	try {
		const npcIndex = await source.getCacheIndex(cacheMajors.npcs);
		for (const group of npcIndex) {
			if (!group) continue;
			const arch = await source.getFileArchive(group);
			for (const file of arch) {
				const logicalId = archiveToFileId(cacheMajors.npcs, group.minor, file.fileid);
				try {
					const npc = parse.npc.read(file.buffer, source);
					const morphs = npc.morphs_1 || npc.morphs_2;
					if (morphs && morphs.unk1 !== undefined) {
						const varbit = (morphs.unk1 >> 16) & 0xFFFF;
						const varp = morphs.unk1 & 0xFFFF;
						addTrigger(varbit, 'npcs', 'varbits', logicalId);
						addTrigger(varp, 'npcs', 'varps', logicalId);
					}
				} catch (e) {}
			}
		}
	} catch (e) {
		console.error("Failed NPC scan:", e);
	}

	// 2. Scan Objects (Major 16)
	console.log("Scanning Objects (Major 16) for Morph Pointers...");
	try {
		const objIndex = await source.getCacheIndex(cacheMajors.objects);
		for (const group of objIndex) {
			if (!group) continue;
			const arch = await source.getFileArchive(group);
			for (const file of arch) {
				const logicalId = archiveToFileId(cacheMajors.objects, group.minor, file.fileid);
				try {
					const obj = parse.object.read(file.buffer, source);
					const morphs = obj.morphs_1 || obj.morphs_2;
					if (morphs && morphs.unk1 !== undefined) {
						const varbit = (morphs.unk1 >> 16) & 0xFFFF;
						const varp = morphs.unk1 & 0xFFFF;
						addTrigger(varbit, 'objects', 'varbits', logicalId);
						addTrigger(varp, 'objects', 'varps', logicalId);
					}
				} catch (e) {}
			}
		}
	} catch (e) {
		console.error("Failed Object scan:", e);
	}

	// 3. Scan Materials (Major 26) - Triple-Source Logic Integration
	console.log("Scanning Materials (Major 26) with Expert Logic (module-6897)...");
	try {
		const matIndex = await source.getCacheIndex(cacheMajors.materials);
		for (const group of matIndex) {
			if (!group) continue;
			const arch = await source.getFileArchive(group);
			for (const file of arch) {
				const logicalId = archiveToFileId(cacheMajors.materials, group.minor, file.fileid);
				try {
					const mat = parse.materials.read(file.buffer, source);
					const flags: string[] = [];
					const version = mat.version ?? 0;
					const vflags = (version === 1 ? mat.v1?.flags : version === 2 ? mat.v2?.flags : undefined);
					
					if (vflags !== undefined) {
						if (vflags & (1 << 5)) flags.push("hasDiffuse");
						if (vflags & (1 << 6)) flags.push("hasNormal");
						if (vflags & (1 << 7)) flags.push("hasCompound");
						if (vflags & (1 << 8)) flags.push("hasUVanimU");
						if (vflags & (1 << 9)) flags.push("hasUVanimV");
						if (vflags & (1 << 13)) flags.push("isGlasslike");
						if (vflags & (1 << 17)) flags.push("ignoreVertexCol");
					}
					
					synthesis.materials[logicalId] = { version, flags };
				} catch (e) {}
			}
		}
	} catch (e) {
		console.error("Failed Material scan:", e);
	}

	const outPath = path.join(PEDAGOGY_ROOT, "taxonomic_synthesis.json");
	fs.writeFileSync(outPath, JSON.stringify(synthesis, null, "\t"));
	
	console.log(`\nSovereign Taxonomic Synthesis Complete.`);
	console.log(`- Varbit Triggers: ${Object.keys(synthesis.varbits).length}`);
	console.log(`- Varp Triggers: ${Object.keys(synthesis.varps).length}`);
	console.log(`- Material Archetypes: ${Object.keys(synthesis.materials).length}`);
	console.log(`Saved to ${outPath}`);
}

extractTaxonomic().catch(err => {
	console.error("Extraction failed:", err);
	process.exit(1);
});


