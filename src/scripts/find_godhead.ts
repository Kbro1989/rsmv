import Database from 'better-sqlite3';

const dbPath = 'D:/sovereign/memory/rsmv_cache.db';
const db = new Database(dbPath);

const results = db.prepare("SELECT * FROM grounded_entities WHERE entity_name LIKE '%God%' OR entity_name LIKE '%Head%'").all();
console.log(JSON.stringify(results, null, 2));

db.close();
