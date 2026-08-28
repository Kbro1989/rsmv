import Database from 'better-sqlite3';

async function main() {
    const dbPath = "C:\\ProgramData\\Jagex\\RuneScape-BETA\\js5-3.jcache";
    const db = new Database(dbPath, { readonly: true });
    
    // Major 3 index
    // In jcache, index files are at KEY | 0x80000000
    const indexRow = db.prepare(`SELECT DATA FROM cache WHERE KEY=?`).get(3 | 0x80000000);
    if (indexRow) {
        // Parse index... wait, index is complicated.
        // Let's just use the GameCacheLoader
    }
    
    db.close();
}
// Actually, let's just write a script that uses GameCacheLoader from the rsmv_inspector
