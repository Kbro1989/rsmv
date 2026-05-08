import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const source = new GameCacheLoader();
    const outputDir = path.resolve(__dirname, "../../data");
    const outputPath = path.join(outputDir, "item_extras.json");

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log("🧬 GOLDRUSH: Extracting Item Extras (0xF9) Lexicon...");

    const itemIndex = await source.getCacheIndex(cacheMajors.items);
    const totalItems = itemIndex.length;
    const lexicon: Record<number, any> = {};

    let processed = 0;
    let found = 0;

    for (let id = 0; id < totalItems; id++) {
        const indexEntry = itemIndex[id];
        if (!indexEntry) continue;

        try {
            const file = await source.getFileById(cacheMajors.items, id);
            if (!file) continue;

            const item = parse.item.read(file, source) as any;
            processed++;

            if (item.extra && item.extra.length > 0) {
                // Convert extras array to a more useful key-value map for the precompiled table
                const extrasMap: Record<number, any> = {};
                const handlerHints: string[] = [];

                for (const extra of item.extra) {
                    extrasMap[extra.key] = extra.intvalue !== undefined ? extra.intvalue : extra.stringvalue;
                }

                // Add Handler Hints based on known keys or names
                if (item.name?.includes("Clue")) handlerHints.push("ClueHandler");
                if (item.name?.includes("Teleport")) handlerHints.push("TeleportHandler");
                if (extrasMap[528] !== undefined) handlerHints.push("InteractionHandler"); // Generic 0xF9 hook

                lexicon[id] = {
                    name: item.name,
                    extras: extrasMap,
                    handlerHints
                };
                found++;
            }

            if (processed % 1000 === 0) {
                process.stdout.write(`\r  Progress: ${processed}/${totalItems} (Found: ${found})`);
            }
        } catch (e) {
            // Some items might fail if cache is incomplete or parser hits a bad opcode
            // console.error(` [ERR] Item ${id} failed: ${e}`);
        }
    }

    console.log(`\n✅ Extraction Complete. Found ${found} items with extras.`);
    fs.writeFileSync(outputPath, JSON.stringify(lexicon, null, 2));
    console.log(`📂 Lexicon saved to: ${outputPath}`);

    source.close();
}

main().catch(err => {
    console.error("FATAL BOMB:", err);
    process.exit(1);
});
