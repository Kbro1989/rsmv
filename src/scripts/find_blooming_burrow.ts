import * as fs from "fs";
import * as path from "path";
import { GameCacheLoader } from "../cache/sqlite";
import { parse } from "../opdecoder";
import { cacheMajors } from "../constants";
import { archiveToFileId } from "../cache";

const CACHE_DIR = "C:\\ProgramData\\Jagex\\RuneScape";

async function findBloomingBurrow() {
	if (!fs.existsSync(CACHE_DIR)) {
		console.error(`Cache database not found at ${CACHE_DIR}`);
		process.exit(1);
	}

	const source = new GameCacheLoader(CACHE_DIR);

	const targets = ["blooming burrow", "easter bunny", "nougat bunny", "fizzy bunny", "stewy bunny", "egg plant", "chocolate rock", "chocolate burrow", "soft metal forge", "foil storage", "gummy bunny", "cocoa bunny"];

	const results = {
		npcs: [] as any[],
		objects: [] as any[],
		mapzones: [] as any[],
        items: [] as any[]
	};

	const testMatch = (name: string | undefined | null) => {
		if (!name) return false;
		const lower = name.toLowerCase();
		return targets.some(t => lower.includes(t));
	};

	console.log("Scanning NPCs...");
	try {
		const npcIndex = await source.getCacheIndex(cacheMajors.npcs);
		for (const group of npcIndex) {
			if (!group) continue;
			const arch = await source.getFileArchive(group);
			for (const file of arch) {
				const logicalId = archiveToFileId(cacheMajors.npcs, group.minor, file.fileid);
				try {
					const npc = parse.npc.read(file.buffer, source);
					if (testMatch(npc.name)) {
						results.npcs.push({ id: logicalId, name: npc.name });
					}
				} catch (e) {}
			}
		}
	} catch (e) { console.error(e); }

	console.log("Scanning Objects...");
	try {
		const objIndex = await source.getCacheIndex(cacheMajors.objects);
		for (const group of objIndex) {
			if (!group) continue;
			const arch = await source.getFileArchive(group);
			for (const file of arch) {
				const logicalId = archiveToFileId(cacheMajors.objects, group.minor, file.fileid);
				try {
					const obj = parse.object.read(file.buffer, source);
					if (testMatch(obj.name)) {
						results.objects.push({ id: logicalId, name: obj.name });
					}
				} catch (e) {}
			}
		}
	} catch (e) { console.error(e); }
    
	console.log("Scanning Mapzones (Major 3 / 62)...");
    // Depending on version, mapzones could be in different indices. Let's scan config types if available or skip if unknown.
	try {
		// Mapzones are config group 62
		const configIndex = await source.getCacheIndex(cacheMajors.config);
        const mapzoneGroup = configIndex[62];
		if (mapzoneGroup) {
			const arch = await source.getFileArchive(mapzoneGroup);
			for (const file of arch) {
				try {
					const mz = parse.mapZones.read(file.buffer, source);
					if (testMatch(mz.name)) {
						results.mapzones.push({ id: file.fileid, name: mz.name });
					}
				} catch (e) {}
			}
		}
	} catch (e) { console.error(e); }

	console.log(`\nFound Entities:`);
	console.log(`Mapzones:`, results.mapzones);
	console.log(`NPCs:`, results.npcs.length, results.npcs);
	console.log(`Objects:`, results.objects.length, results.objects);
    
    fs.writeFileSync("blooming_burrow_entities.json", JSON.stringify(results, null, 2));
    console.log("Saved to blooming_burrow_entities.json");
}

findBloomingBurrow().catch(err => {
	console.error(err);
	process.exit(1);
});
