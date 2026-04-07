/**
 * 🧬 Interface Substrate Reconnaissance (Advanced)
 * 
 * Extracts UI Component Strings and Sprite IDs (js5-8) from 
 * Interface definitions.
 */

import Database from 'better-sqlite3';
import { inflateSync, gunzipSync } from 'zlib';

function decompress(raw: Buffer): Buffer {
    if (raw.length < 3) return raw;
    if (raw.slice(0, 3).toString() === 'ZLB') return inflateSync(raw.slice(8));
    if (raw[0] === 0x1f && raw[1] === 0x8b) return gunzipSync(raw);
    if (raw[0] === 0x78) { try { return inflateSync(raw); } catch(e) { return raw; } }
    return raw;
}

const db = new Database('C:\\\\ProgramData\\\\Jagex\\\\RuneScape\\\\js5-3.jcache', { readonly: true });

function analyzeInterface(id: number) {
    const row = db.prepare('SELECT DATA FROM cache WHERE KEY = ?').get(id) as any;
    if (!row) { console.log(`Interface ${id} not found.`); return; }

    const data = decompress(row.DATA);
    console.log(`\\n=== Interface ${id} ===`);
    console.log(`Size: ${data.length} bytes`);

    // Extract Strings
    const strings: {offset: number, value: string}[] = [];
    let strStart = -1;
    for (let i = 0; i < data.length; i++) {
        const b = data[i];
        if (b >= 0x20 && b <= 0x7E) {
            if (strStart === -1) strStart = i;
        } else {
            if (strStart !== -1) {
                if (i - strStart >= 4) {
                    strings.push({ offset: strStart, value: data.toString('utf-8', strStart, i) });
                }
                strStart = -1;
            }
        }
    }

    let currentGroup: string[] = [];
    let lastOffset = 0;
    console.log('📝 UI Clusters:');
    for (const s of strings) {
        if (s.offset - lastOffset > 50 && currentGroup.length > 0) {
            console.log(`  -> ${currentGroup.join(' | ')}`);
            currentGroup = [];
        }
        currentGroup.push(s.value);
        lastOffset = s.offset + s.value.length;
    }
    if (currentGroup.length > 0) console.log(`  -> ${currentGroup.join(' | ')}`);

    // Look for Sprite ID patterns (often stored as Int32 between 0 and 35000 since js5-8 has 35k groups)
    const sprites = new Set<number>();
    for (let i = 0; i < data.length - 4; i += 4) {
        const val = data.readInt32BE(i);
        // If it's a valid sprite ID from our earlier boundary map (js5-8 has 35,459 groups)
        if (val > 100 && val < 35460) {
            // Further verification: sprites are often clumped or paired with layout metrics
            sprites.add(val);
        }
    }
    
    // Convert to array and sample
    const spriteArr = [...sprites];
    console.log(`\\n🖼️ Potential Sprite IDs Attached (Archive 8):`);
    console.log(`  Hits: ${spriteArr.length} references.`);
    if (spriteArr.length > 0) {
        console.log(`  Samples: [${spriteArr.slice(0, 15).join(', ')}]`);
    }
}

// 1433: Core Settings/Controls
// 144: Settings/Controls
// 1922: Edit Mode/Clan
analyzeInterface(1433);
analyzeInterface(144);
analyzeInterface(1922);

db.close();
