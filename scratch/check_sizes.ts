import Database from 'better-sqlite3';

async function main() {
    const dbPath = "C:\\ProgramData\\Jagex\\RuneScape-BETA\\js5-3.jcache";
    const db = new Database(dbPath, { readonly: true });
    
    // Get the index record for major 3
    const indexRow = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(3 | 0x80000000); // Wait, this might be wrong key
    // Actually, major 3 index is usually at a specific key.
    // In GameCacheLoader.generateRootIndex, it reads js5-X.jcache.
    // The index for major 3 is in js5-3.jcache itself? No.
    
    // Wait, let's just check the data for 1404 and 1946
    const row1404 = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(1404);
    const row1946 = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(1946);
    
    if (row1404) console.log(`1404 raw size: ${row1404.DATA.length}`);
    if (row1946) console.log(`1946 raw size: ${row1946.DATA.length}`);
    
    db.close();
}

main().catch(console.error);
