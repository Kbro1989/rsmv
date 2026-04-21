import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { inflateSync, gunzipSync } from 'zlib';

/**
 * OPERATION DECODE CACHE: Universal Integer ID Harvester
 *
 * Recursively walks ALL JSON files across:
 *   - D:\sovereign\cache_pedagogy\json_dumps\
 *   - D:\sovereign\memory\pedagogy\
 *
 * Extracts every integer value found (quests, achievements, skills, kinematics,
 * varbits, enums, dbtables, sequences, params, dbrows, etc.) and brute-force
 * scans Major 12 (ClientScripts) for each as a 4-byte BE integer.
 *
 * Outputs: D:\sovereign\atlas\system\true_integer_links.json
 *
 * Usage: npx tsx src/tools/auditors/harvest_integer_ids.ts [--dry-run]
 */

const CACHE_DIR  = "C:\ProgramData\Jagex\RuneScape";
const SCAN_ROOTS = [
    "D:\\sovereign\\cache_pedagogy\\json_dumps",
    "D:\\sovereign\\memory\\pedagogy",
];

// Files to skip — either too large, spatial coordinates (Z=0 offset bug from rsmv stage),
// or contain no meaningful logic IDs
const SKIP_FILES = new Set([
    // Too large / not logic IDs
    "sequences.json",                // 154MB — animation frame refs
    "RS3_Examine_Authority.json",    // string lookup
    "materials.json",                // 27MB — texture/render data

    // Spatial synthesis outputs: contain world coordinates (X/Y/Z integers)
    // from rsmv stage level 0 which was offsetting game Z to 0 — not logic IDs
    "prifddinas_synthesis.json",
    "havenhythe_synthesis.json",
    "sandbox_synthesis.json",
    "mapzones_registry.json",        // mapsquare coords
    "worldmap.json",                 // world coord data
    "spatial_pedagogy.json",
    "prifddinas_grounding_raw.json",
    "prifddinas_research_results.json",
    // world_extract mapsquare files are under atlas/spatial — not in scan roots anyway
]);


const OUTPUT_FILE  = "D:\\sovereign\\atlas\\system\\true_integer_links.json";
const MAJOR_CS     = 12;
const MIN_ID       = 2;      // skip 0, 1 — ubiquitous noise
const MAX_ID       = 200000; // RS3 IDs don't exceed ~150k; avoid false positives

// ─── Decompressor ──────────────────────────────────────────────────────────────
function decompress(raw: Buffer): Buffer {
    if (raw.length < 3) return raw;
    if (raw.slice(0, 3).toString() === 'ZLB') return inflateSync(raw.slice(8));
    if (raw[0] === 0x1f && raw[1] === 0x8b) return gunzipSync(raw);
    if (raw[0] === 0x78) { try { return inflateSync(raw); } catch { return raw; } }
    return raw;
}

// ─── Recursive integer extractor ───────────────────────────────────────────────
function harvestIntegers(
    value: any,
    sourceLabel: string,
    out: Map<number, string[]>,
    depth = 0
) {
    if (depth > 20) return; // prevent runaway descent into deeply nested structures
    if (value === null || value === undefined) return;

    const type = typeof value;

    if (type === 'number' && Number.isInteger(value) && value >= MIN_ID && value <= MAX_ID) {
        if (!out.has(value)) out.set(value, []);
        const labels = out.get(value)!;
        if (labels.length < 5) labels.push(sourceLabel); // cap labels per ID to avoid bloat
        return;
    }

    if (type === 'string') return; // strings not relevant here — handled by goldrush_register
    if (type === 'boolean') return;

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            harvestIntegers(value[i], `${sourceLabel}[${i}]`, out, depth + 1);
        }
        return;
    }

    if (type === 'object') {
        for (const key of Object.keys(value)) {
            harvestIntegers(value[key], `${sourceLabel}.${key}`, out, depth + 1);
        }
    }
}

// ─── Walk a directory and return all .json file paths ─────────────────────────
function walkJsonFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            results.push(...walkJsonFiles(path.join(dir, entry.name)));
        } else if (entry.name.endsWith('.json') && !SKIP_FILES.has(entry.name)) {
            results.push(path.join(dir, entry.name));
        }
    }
    return results;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const dryRun = process.argv.includes('--dry-run');
    console.log("🔍 OPERATION DECODE CACHE: Universal Integer ID Harvester");
    console.log("===========================================================");
    if (dryRun) console.log("   [DRY RUN — no CS2 scan, just ID collection]");

    const candidateIds = new Map<number, string[]>(); // id → source labels

    // ── Phase 1: Collect from all JSON files ──────────────────────────────
    console.log("\n📦 Phase 1: Harvesting integers from all truth-source JSON files...");

    for (const root of SCAN_ROOTS) {
        const files = walkJsonFiles(root);
        console.log(`\n   📁 ${root} — ${files.length} JSON files`);

        for (const filePath of files) {
            const fileName = path.basename(filePath);
            const relLabel = path.relative(root, filePath).replace(/\\/g, '/');
            const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);

            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                if (raw.trim() === '{}' || raw.trim() === '[]' || raw.trim() === '' || raw.trim() === '2') {
                    console.log(`   ⏭️  ${fileName} (${sizeMB}MB) — empty, skipping`);
                    continue;
                }

                const data = JSON.parse(raw);
                const before = candidateIds.size;
                console.log(`   📄 ${fileName} (${sizeMB}MB)...`);
                harvestIntegers(data, relLabel, candidateIds);
                const added = candidateIds.size - before;
                console.log(`      +${added} new IDs (total: ${candidateIds.size})`);
            } catch (e: any) {
                console.warn(`   ⚠️  ${fileName} — parse error: ${e.message?.slice(0, 80)}`);
            }
        }
    }

    console.log(`\n🔥 Total UNIQUE integer IDs harvested: ${candidateIds.size}`);

    if (dryRun) {
        console.log("\n[DRY RUN] Skipping CS2 scan. Sample of harvested IDs:");
        let count = 0;
        for (const [id, labels] of candidateIds) {
            if (count++ >= 20) break;
            console.log(`  ${id} ← ${labels[0]}`);
        }
        return;
    }

    // ── Phase 2: Load all CS2 scripts from cache ──────────────────────────
    const scriptDb = path.join(CACHE_DIR, `js5-${MAJOR_CS}.jcache`);
    if (!fs.existsSync(scriptDb)) {
        console.error(`❌ ClientScript cache not found: ${scriptDb}`);
        return;
    }

    console.log(`\n🦾 Phase 2: Loading CS2 scripts from cache...`);
    const db = new Database(scriptDb, { readonly: true });
    const rows = db.prepare("SELECT KEY, DATA FROM cache").all() as { KEY: number, DATA: Buffer }[];

    const scripts: { key: number, data: Buffer }[] = [];
    for (const row of rows) {
        try { scripts.push({ key: row.KEY, data: decompress(row.DATA) }); } catch { /* skip */ }
    }
    db.close();
    console.log(`   ✅ ${scripts.length} CS2 scripts loaded & decompressed.`);

    // ── Phase 3: Scan every ID against every script ───────────────────────
    console.log(`\n🔬 Phase 3: Scanning ${candidateIds.size} IDs against ${scripts.length} CS2 scripts...`);
    console.log(`   (This may take 2-5 minutes depending on dataset size)`);

    const results: Record<string, { sources: string[], scriptCount: number, scripts: number[] }> = {};
    let processed = 0;

    for (const [id, labels] of candidateIds) {
        const needle = Buffer.alloc(4);
        needle.writeInt32BE(id, 0);
        const hits: number[] = [];
        for (const s of scripts) {
            if (s.data.includes(needle)) hits.push(s.key);
        }
        if (hits.length > 0) {
            results[id] = { sources: labels, scriptCount: hits.length, scripts: hits };
        }
        processed++;
        if (processed % 10000 === 0) {
            const pct = ((processed / candidateIds.size) * 100).toFixed(1);
            console.log(`   ${pct}% — ${processed}/${candidateIds.size} scanned, ${Object.keys(results).length} with hits`);
        }
    }

    // ── Phase 4: Write output ─────────────────────────────────────────────
    console.log(`\n✅ Scan complete. ${Object.keys(results).length} IDs found in CS2 bytecode.`);
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`💾 Saved → ${OUTPUT_FILE}`);

    // Top 20 preview
    const top = Object.entries(results)
        .sort((a, b) => b[1].scriptCount - a[1].scriptCount)
        .slice(0, 20);
    console.log(`\n--- Top 20 most-referenced IDs across CS2 ---`);
    for (const [id, data] of top) {
        const src = data.sources[0] ?? '?';
        console.log(`  ID ${String(id).padStart(7)} → ${data.scriptCount} CS2 scripts | ${src}`);
    }
}

main().catch(console.error);

