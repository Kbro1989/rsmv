import Database from 'better-sqlite3';

function searchCache() {
    const dbPath = 'C:\\\\ProgramData\\\\Jagex\\\\RuneScape\\js5-12.jcache';
    console.log(`Open: ${dbPath}`);
    const db = new Database(dbPath, { readonly: true });
    
    // SQLite allows hex strings to search blobs in INSTR
    // "right level" in hex is 7269676874206c6576656c
    // "wrong level" in hex is 77726f6e67206c6576656c
    // But since JS files might contain different casing, we can use a small regex over the returned blobs
    // Or we can just search for "level" in hex: 6c6576656c
    
    console.log(`Starting fast query...`);
    // 'level' = 6c6576656c
    // ' right level' = 207269676874206c6576656c
    const query = `
        SELECT KEY FROM cache 
        WHERE instr(DATA, x'7269676874206c6576656c') > 0
           OR instr(DATA, x'5269676874206c6576656c') > 0
    `;
    
    const rows = db.prepare(query).all();
    console.log(`Matches:`, rows.length);
    for (const row of rows) {
        console.log(`Match at KEY (Archive ID): ${row.KEY}`);
        
        // Fetch it
        const data = db.prepare('SELECT DATA FROM cache WHERE KEY = ?').get(row.KEY);
        if (data && data.DATA) {
             const buf = data.DATA;
             const idx = buf.indexOf(Buffer.from("ght level", "utf8")) - 2;
             const start = Math.max(0, idx - 40);
             const end = Math.min(buf.length, idx + 40);
             console.log(`Context: "${buf.toString('utf8', start, end).replace(/\n|\r|\0/g, ' ')}"`);
        }
    }
    
    db.close();
}

searchCache();


