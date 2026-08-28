const Database = require('better-sqlite3');
try {
    const db = new Database(':memory:');
    console.log('✅ better-sqlite3 loaded successfully in rsmv_inspector!');
    db.close();
} catch (e) {
    console.error('❌ better-sqlite3 load failed:');
    console.error(e.message);
}
