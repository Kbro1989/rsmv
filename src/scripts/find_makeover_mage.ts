import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";

async function findNpcByName(targetName: string) {
    console.log(`🔍 Searching for raw string: "${targetName}" in Major ${cacheMajors.npcs}...`);
    const source = new GameCacheLoader(CACHE_DIR);
    const index = await source.getCacheIndex(cacheMajors.npcs);
    const targetBuf = Buffer.from(targetName, "utf8");

    let foundCount = 0;
    for (let i = 0; i < index.length; i++) {
        const file = await source.getFile(cacheMajors.npcs, i, 0);
        // Do case-insensitive check by converting buffer to lowercase string
        if (file && file.toString("utf8").toLowerCase().includes(targetName.toLowerCase())) {
            console.log(`\n🎯 Found "${targetName}" in NPC ID: ${i}`);
            // Find the offset of the string to print surrounding hex/text
            const strIndex = file.toString("utf8").toLowerCase().indexOf(targetName.toLowerCase());
            const startStr = Math.max(0, strIndex - 10);
            const endStr = Math.min(file.length, strIndex + targetName.length + 50);
            console.log(`Context Text: ${file.subarray(startStr, endStr).toString("utf8").replace(/[\x00-\x1F\x7F-\x9F]/g, '.')}`);
            console.log(`Hex: ${file.subarray(startStr, endStr).toString("hex")}`);
            foundCount++;
        }
    }
    console.log(`\n✅ Finished scan. Found ${foundCount} results for "${targetName}".`);
    source.close();
}

findNpcByName("Makeover mage").catch(console.error);

