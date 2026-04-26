import Database from 'better-sqlite3';

const dbPath = 'D:/sovereign/memory/rsmv_cache.db';
const db = new Database(dbPath);

const ids = [247, 248, 249, 1024, 1025, 2048]; // Some potential 'god' or 'dragon' IDs
const results = db.prepare(`SELECT * FROM grounded_entities WHERE entity_id IN (${ids.join(',')})`).all();
console.log(JSON.stringify(results, null, 2));

db.close();
