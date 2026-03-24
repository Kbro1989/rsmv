import { EngineCache } from "./src/3d/modeltothree";
import { cacheMajors } from "./src/constants";

async function run() {
    const cachePath = "C:\\ProgramData\\Jagex\\RuneScape";
    const engine = await EngineCache.create(cachePath);
    const sounds = await engine.getArchiveById(cacheMajors.sounds, 0); // Sounds are usually in single files or small archives
    console.log("Found sounds in archive 0:", Object.keys(sounds).length);
    for (let id of Object.keys(sounds).slice(0, 5)) {
        console.log("Sound ID:", id);
    }
}
run();
