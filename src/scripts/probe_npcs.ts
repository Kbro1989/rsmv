import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";

async function findNpcByName(targetName: string) {
    console.log(`🔍 Searching for raw string: "${targetName}" in Major ${cacheMajors.npcs}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    const index = await source.getCacheIndex(cacheMajors.npcs);
    const targetBuf = Buffer.from(targetName, "utf8");

    for (let i = 0; i < index.length; i++) {
        const file = await source.getFile(cacheMajors.npcs, i, 0);
        if (file && file.includes(targetBuf)) {
            console.log(`🎯 Found "${targetName}" in NPC ID: ${i}`);
            console.log(`Hex Context: ${file.subarray(0, 128).toString("hex")}`);
        }
        if (i % 5000 === 0) console.log(`Scanned ${i}...`);
    }
    source.close();
}

async function start() {
    await findNpcByName("Observatory professor");
    await findNpcByName("Sextant"); // Just in case it's an NPC/Object name too
}

start().catch(console.error);

