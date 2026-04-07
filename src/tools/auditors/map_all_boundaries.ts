/**
 * 🧬 Universal Cache Boundary Mapper — Fluid Discovery
 * 
 * NO hardcoded labels. Each archive self-identifies from its own
 * index structure. The data goes to the right bins organically.
 * 
 * Common Variables:
 *   CACHE_DIR  = C:\ProgramData\Jagex\RuneScape
 *   INDEX_KEY  = 1
 *   ZLB_HEADER = "ZLB" → inflateSync(slice(8))
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { inflateSync, gunzipSync } from 'zlib';

// ═══════════════════════════════════════════
// COMMON PATH ENDPOINTS
// ═══════════════════════════════════════════
const CACHE_DIR = 'C:\\ProgramData\\Jagex\\RuneScape';
const OUTPUT_DIR = 'audit_output';
const INDEX_KEY = 1;

// ═══════════════════════════════════════════
// INDEX READER (Protocol 5/6/7)
// ═══════════════════════════════════════════
class IndexReader {
    private buf: Buffer;
    private pos = 0;
    constructor(buf: Buffer) { this.buf = buf; }
    readByte(): number { return this.buf[this.pos++]; }
    readShort(): number { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v; }
    readInt(): number { const v = this.buf.readInt32BE(this.pos); this.pos += 4; return v; }
    readBigSmart(): number {
        return this.buf[this.pos] < 128 ? this.readShort() : this.readInt() & 0x7FFFFFFF;
    }
}

// ═══════════════════════════════════════════
// DECOMPRESSOR (auto-detect)
// ═══════════════════════════════════════════
function decompress(raw: Buffer): Buffer {
    if (raw.length < 3) return raw;
    if (raw.slice(0, 3).toString() === 'ZLB') return inflateSync(raw.slice(8));
    if (raw[0] === 0x1f && raw[1] === 0x8b) return gunzipSync(raw);
    if (raw[0] === 0x78) {
        try { return inflateSync(raw); } catch { return raw; }
    }
    return raw;
}

// ═══════════════════════════════════════════
// FLUID BOUNDARY PARSER
// ═══════════════════════════════════════════
interface ArchiveBoundary {
    archiveId: number;
    jcacheFile: string;
    jcacheSizeBytes: number;
    protocol: number;
    revision: number;
    flags: { names: boolean; whirlpool: boolean; sizes: boolean; hash: boolean };
    groupCount: number;
    groupIdMin: number;
    groupIdMax: number;
    totalSubFiles: number;
    indexRawSize: number;
    indexDecompSize: number;
    // fluid classification from data characteristics
    characteristics: string[];
}

function parseIndex(archiveId: number, rawIndex: Buffer, jcachePath: string): ArchiveBoundary | null {
    try {
        const decompressed = decompress(rawIndex);
        if (decompressed.length < 6) return null;

        const reader = new IndexReader(decompressed);
        const protocol = reader.readByte();
        const revision = protocol >= 6 ? reader.readInt() : 0;
        const flagByte = reader.readByte();
        const flags = {
            names: (flagByte & 0x01) !== 0,
            whirlpool: (flagByte & 0x02) !== 0,
            sizes: (flagByte & 0x04) !== 0,
            hash: (flagByte & 0x08) !== 0
        };

        const groupCount = protocol >= 7 ? reader.readBigSmart() : reader.readShort();

        // Delta-decode group IDs
        let acc = 0;
        let minGid = Infinity, maxGid = 0;
        for (let i = 0; i < groupCount; i++) {
            acc += protocol >= 7 ? reader.readBigSmart() : reader.readShort();
            if (acc < minGid) minGid = acc;
            if (acc > maxGid) maxGid = acc;
        }

        // Skip names
        if (flags.names) for (let i = 0; i < groupCount; i++) reader.readInt();
        // Skip CRCs
        for (let i = 0; i < groupCount; i++) reader.readInt();
        // Skip hash
        if (flags.hash) for (let i = 0; i < groupCount; i++) reader.readInt();
        // Skip whirlpool
        if (flags.whirlpool) for (let i = 0; i < groupCount; i++) { for (let j = 0; j < 64; j++) reader.readByte(); }
        // Skip sizes
        if (flags.sizes) for (let i = 0; i < groupCount; i++) { reader.readInt(); reader.readInt(); }
        // Skip versions
        for (let i = 0; i < groupCount; i++) reader.readInt();

        // Read file counts
        let totalSubFiles = 0;
        const fileCounts: number[] = [];
        for (let i = 0; i < groupCount; i++) {
            const fc = protocol >= 7 ? reader.readBigSmart() : reader.readShort();
            fileCounts.push(fc);
            totalSubFiles += fc;
        }

        // Fluid classification — let the data characteristics speak
        const characteristics: string[] = [];
        const stat = fs.statSync(jcachePath);
        const sizeMB = stat.size / (1024 * 1024);

        if (flags.names) characteristics.push('NAMED');
        else characteristics.push('NUMERIC_ID');

        if (sizeMB > 1000) characteristics.push('MASSIVE');
        else if (sizeMB > 100) characteristics.push('LARGE');
        else if (sizeMB > 10) characteristics.push('MEDIUM');
        else if (sizeMB > 1) characteristics.push('SMALL');
        else characteristics.push('MICRO');

        if (groupCount > 50000) characteristics.push('DENSE');
        else if (groupCount > 5000) characteristics.push('RICH');
        else if (groupCount > 500) characteristics.push('MODERATE');
        else if (groupCount > 50) characteristics.push('SPARSE');
        else characteristics.push('MINIMAL');

        // Check if groups have multi-file entries (composite objects)
        const avgFiles = totalSubFiles / Math.max(groupCount, 1);
        if (avgFiles > 100) characteristics.push('COMPOSITE_HEAVY');
        else if (avgFiles > 10) characteristics.push('COMPOSITE');
        else if (avgFiles > 1.5) characteristics.push('MULTI_FILE');
        else characteristics.push('SINGLE_FILE');

        // Detect spatial archives (groups with coordinate-like IDs)
        const coordLike = fileCounts.filter((_, i) => {
            // Check if group ID looks like (x << 8 | y)
            const gid = minGid + i; // approximation
            const x = (gid >> 8) & 0xFF;
            const y = gid & 0xFF;
            return x >= 20 && x <= 110 && y >= 20 && y <= 220;
        }).length;
        if (coordLike > groupCount * 0.3) characteristics.push('SPATIAL');

        return {
            archiveId,
            jcacheFile: path.basename(jcachePath),
            jcacheSizeBytes: stat.size,
            protocol,
            revision,
            flags,
            groupCount,
            groupIdMin: minGid === Infinity ? 0 : minGid,
            groupIdMax: maxGid,
            totalSubFiles,
            indexRawSize: rawIndex.length,
            indexDecompSize: decompressed.length,
            characteristics
        };
    } catch (err) {
        console.error(`  ⚠️ js5-${archiveId}: ${(err as Error).message}`);
        return null;
    }
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
console.log('🧬 UNIVERSAL CACHE BOUNDARY MAPPER — FLUID DISCOVERY');
console.log('=====================================================\n');

const jcacheFiles = fs.readdirSync(CACHE_DIR)
    .filter(f => /^js5-\d+\.jcache$/.test(f))
    .sort((a, b) => {
        return parseInt(a.match(/js5-(\d+)/)?.[1] || '0') - parseInt(b.match(/js5-(\d+)/)?.[1] || '0');
    });

console.log(`📂 ${CACHE_DIR}`);
console.log(`📦 ${jcacheFiles.length} volumes detected\n`);

const boundaries: ArchiveBoundary[] = [];

for (const file of jcacheFiles) {
    const archiveId = parseInt(file.match(/js5-(\d+)/)?.[1] || '0');
    const jcachePath = path.join(CACHE_DIR, file);

    try {
        const db = new Database(jcachePath, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];

        if (!tables.some(t => t.name === 'cache_index')) {
            console.log(`  [${archiveId.toString().padStart(2)}] ${file.padEnd(20)} ⚠️  No index`);
            db.close();
            continue;
        }

        const row = db.prepare(`SELECT DATA FROM cache_index WHERE KEY = ${INDEX_KEY}`).get() as { DATA: Buffer } | undefined;
        db.close();

        if (!row?.DATA) {
            console.log(`  [${archiveId.toString().padStart(2)}] ${file.padEnd(20)} ⚠️  Empty index`);
            continue;
        }

        const boundary = parseIndex(archiveId, row.DATA, jcachePath);
        if (boundary) {
            boundaries.push(boundary);
            const sizeMB = (boundary.jcacheSizeBytes / (1024 * 1024)).toFixed(1);
            console.log(
                `  [${archiveId.toString().padStart(2)}] ${file.padEnd(20)} ` +
                `Groups: ${boundary.groupCount.toString().padStart(6)} | ` +
                `Files: ${boundary.totalSubFiles.toString().padStart(8)} | ` +
                `${sizeMB.padStart(8)} MB | ` +
                `[${boundary.characteristics.join(', ')}]`
            );
        }
    } catch (err) {
        console.log(`  [${archiveId.toString().padStart(2)}] ${file.padEnd(20)} ❌ ${(err as Error).message}`);
    }
}

// ═══════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log('📊 BOUNDARY TOTALS');
console.log('═══════════════════════════════════════════\n');

const totalGroups = boundaries.reduce((s, b) => s + b.groupCount, 0);
const totalFiles = boundaries.reduce((s, b) => s + b.totalSubFiles, 0);
const totalSize = boundaries.reduce((s, b) => s + b.jcacheSizeBytes, 0);

console.log(`  Volumes:     ${boundaries.length}`);
console.log(`  Groups:      ${totalGroups.toLocaleString()}`);
console.log(`  Sub-files:   ${totalFiles.toLocaleString()}`);
console.log(`  Total Size:  ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);

// Group by characteristics
const charGroups = new Map<string, number[]>();
for (const b of boundaries) {
    for (const c of b.characteristics) {
        if (!charGroups.has(c)) charGroups.set(c, []);
        charGroups.get(c)!.push(b.archiveId);
    }
}

console.log('\n📋 CHARACTERISTIC BINS (Fluid):');
for (const [char, ids] of [...charGroups.entries()].sort()) {
    console.log(`  ${char.padEnd(20)} → js5-[${ids.join(', ')}]`);
}

// Write outputs
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, 'cache_boundary_map.json'), JSON.stringify(boundaries, null, 2));
console.log(`\n✅ audit_output/cache_boundary_map.json`);
