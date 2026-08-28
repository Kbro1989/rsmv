import fs from 'fs';
import path from 'path';

const DUMP_DIR = 'D:/sovereign/cache_pedagogy/json_dumps/dbrows.json';
const OUTPUT_FILE = 'D:/sovereign/atlas/system/dbrows.json';

async function mergeDbRows() {
    console.log(`🚀 Consolidating DBRows from ${DUMP_DIR}...`);
    
    if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    }

    const files = fs.readdirSync(DUMP_DIR).filter(f => f.endsWith('.json'));
    const merged: Record<string, any> = {};

    for (const file of files) {
        const id = file.match(/dbrows-(\d+)\.json/)?.[1];
        if (!id) continue;

        try {
            const content = JSON.parse(fs.readFileSync(path.join(DUMP_DIR, file), 'utf8'));
            merged[id] = content;
        } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));
    console.log(`✅ Consolidated ${Object.keys(merged).length} DBRows into ${OUTPUT_FILE}`);
}

mergeDbRows().catch(console.error);
