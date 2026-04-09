import { GameCacheLoader } from '../cache/sqlite.js';
import { cacheMajors } from '../constants.js';
import { parse } from '../opdecoder.js';
import * as fs from 'fs';

async function extractVocabulary() {
    console.log("== Sovereign Forensic Logic: Live Vocabulary Extractor ==");
    const cache = new GameCacheLoader('C:\\ProgramData\\Jagex\\RuneScape');
    const vocabulary: Record<string, number> = {};

    const configs = [
        { major: cacheMajors.npcs, parser: parse.npc, label: 'NPC' },
        { major: cacheMajors.objects, parser: parse.object, label: 'Object' },
        { major: cacheMajors.items, parser: parse.item, label: 'Item' }
    ];

    for (const config of configs) {
        console.log(`Crawling ${config.label} Archive...`);
        let actionCount = 0;

        // Sampling sweep of IDs
        for (let i = 0; i < 25000; i++) {
            try {
                const file = await cache.getFileById(config.major, i);
                if (!file) continue;
                
                const def = config.parser.read(file, cache);
                
                // Aggregator logic
                Object.keys(def).forEach(key => {
                    if (key.includes('action') && def[key] && typeof def[key] === 'string') {
                        const action = def[key].trim();
                        vocabulary[action] = (vocabulary[action] || 0) + 1;
                        actionCount++;
                    }
                });
            } catch (e) {
                // Skip missing files
            }
            if (i % 5000 === 0) console.log(`  Processed ${i} ${config.label}s...`);
        }
    }

    const sorted = Object.entries(vocabulary)
        .sort((a, b) => b[1] - a[1]);

    const output = {
        meta: {
            timestamp: new Date().toISOString(),
            source: 'RS3_Live_Cache'
        },
        actions: sorted
    };

    fs.writeFileSync('C:\\Users\\Destiny\\Desktop\\pog-vibe-interactive\\files\\public\\interaction_vocabulary.json', JSON.stringify(output, null, 2));
    console.log(`✅ Vocabulary Synthesis Complete. Extracted ${sorted.length} unique handles.`);
    cache.close();
}

extractVocabulary().catch(console.error);
