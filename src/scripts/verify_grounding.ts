import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = 'D:\\sovereign\\memory\\rsmv_cache.db';
const db = new Database(dbPath);

const rows = db.prepare('SELECT * FROM grounded_entities LIMIT 10').all();
console.log(JSON.stringify(rows, null, 2));

const count = db.prepare('SELECT COUNT(*) as c FROM grounded_entities').get();
console.log(`Total grounded entities: ${count.c}`);

db.close();
