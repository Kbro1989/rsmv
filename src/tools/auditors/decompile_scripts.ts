import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { inflateSync, gunzipSync } from 'zlib';
import { GameCacheLoader } from '../../cache/sqlite';
import { renderClientScript } from '../../clientscript/index';
import { cacheMajors } from '../../constants';

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const OUTPUT_DIR = path.resolve(__dirname, "../../../output/decompiled");

function decompress(raw: Buffer): Buffer {
    if (raw.length < 3) return raw;
    if (raw.slice(0, 3).toString() === 'ZLB') return inflateSync(raw.slice(8));
    if (raw[0] === 0x1f && raw[1] === 0x8b) return gunzipSync(raw);
    if (raw[0] === 0x78) { try { return inflateSync(raw); } catch { return raw; } }
    return raw;
}

/**
 * Operation Decode Cache: Direct CS2 Decompiler
 * Reads specific ClientScript IDs directly from the .jcache SQLite database
 * and renders them as TypeScript pseudocode via the native rsmv decompiler.
 * 
 * Usage: npx tsx src/tools/auditors/decompile_scripts.ts <scriptId1> [scriptId2] ...
 */
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("❌ Usage: npx tsx src/tools/auditors/decompile_scripts.ts <scriptId1> [scriptId2] ...");
        return;
    }

    const scriptIds = args.map(a => parseInt(a, 10)).filter(n => !isNaN(n));
    if (scriptIds.length === 0) {
        console.error("❌ No valid script IDs provided.");
        return;
    }

    const scriptDb = path.resolve(CACHE_DIR, `js5-${cacheMajors.clientscript}.jcache`);
    if (!fs.existsSync(scriptDb)) {
        console.error(`❌ Cache not found at ${scriptDb}`);
        return;
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log(`🔍 OPERATION DECODE CACHE: Decompiling ${scriptIds.length} script(s)...`);

    const source = new GameCacheLoader();

    for (const scriptId of scriptIds) {
        console.log(`\n📜 [Script ${scriptId}] Reading from cache...`);
        try {
            const buf = await source.getFileById(cacheMajors.clientscript, scriptId);
            await renderAndSave(source, buf, scriptId);
        } catch (err) {
            console.error(`   ❌ Error reading Script ${scriptId}:`, err);
        }
    }
    console.log(`\n✅ Complete. Decompiled scripts saved to: ${OUTPUT_DIR}`);
}

async function renderAndSave(source: GameCacheLoader, buf: Buffer, scriptId: number) {
    try {
        console.log(`   🔧 Decompiling Script ${scriptId}...`);
        const code = await renderClientScript(source, buf, scriptId);
        const outFile = path.join(OUTPUT_DIR, `cs2_${scriptId}.ts`);
        fs.writeFileSync(outFile, code, 'utf-8');
        console.log(`   ✅ Saved to: ${outFile}`);
        // Print first 50 lines as preview
        const lines = code.split('\n').slice(0, 50);
        console.log(`   --- Preview (first 50 lines) ---`);
        lines.forEach(l => console.log(`   ${l}`));
        if (code.split('\n').length > 50) console.log(`   ... [truncated]`);
    } catch (err) {
        console.error(`   ❌ Decompile error for Script ${scriptId}:`, err);
    }
}

main().catch(console.error);

