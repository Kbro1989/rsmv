import { EngineCache } from "./3d/modeltothree";
import { cacheMajors } from "./constants";
import { GameCacheLoader } from "./cache/sqlite";

async function run() {
    const cachePath = "C:\\ProgramData\\Jagex\\RuneScape";
    const cacheSource = new GameCacheLoader(cachePath);
    const engine = await EngineCache.create(cacheSource);

    // Enumerate what majors are actually in this cache
    console.log("=== Available Cache Majors ===");
    for (const [name, majorId] of Object.entries(cacheMajors)) {
        try {
            const idx = await engine.getCacheIndex(majorId as number);
            if (idx && idx.length > 0) {
                console.log(`  Major ${majorId} (${name}): ${idx.length} entries`);
            }
        } catch {
            // not available
        }
    }

    // Try sounds (major 14) — might not be cached locally
    try {
        const sounds = await engine.getArchiveById(cacheMajors.sounds, 0);
        console.log("\nFound sounds in archive 0:", Object.keys(sounds).length);
        for (let id of Object.keys(sounds).slice(0, 5)) {
            console.log("Sound ID:", id);
        }
    } catch (e: any) {
        console.warn(`\nSounds major (14) not available: ${e.message}`);
        console.log("This is expected if the RS client hasn't downloaded audio archives.");
        console.log("The audio.jsonc opcode schema at rsmv/src/opcodes/audio.jsonc is still intact for parsing.");
    }
}
run();
