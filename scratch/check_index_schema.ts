import Database from 'better-sqlite3';
import * as fs from 'fs';

async function main() {
    const dbPath = "C:\\ProgramData\\Jagex\\RuneScape-BETA\\js5-index.jcache";
    if (!fs.existsSync(dbPath)) {
        console.log("Index DB not found");
        return;
    }
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("Tables:", tables.map(t => t.name).join(', '));
    
    for (const table of tables) {
        try {
            const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
            console.log(`Table ${table.name} columns:`, columns.map(c => c.name).join(', '));
        } catch (e) {}
    }
    
    db.close();
}

main().catch(console.error);
