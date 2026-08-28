import Database from 'better-sqlite3';
import * as fs from 'fs';

function searchAllCaches() {
    const dir = 'C:\\\\ProgramData\\\\Jagex\\\\RuneScape';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jcache'));
    
    for (const f of files) {
        const dbPath = `${dir}\\${f}`;
        const db = new Database(dbPath, { readonly: true });
        
        try {
            const query = `
                SELECT KEY FROM cache 
                WHERE instr(DATA, x'7269676874206c6576656c') > 0
                   OR instr(DATA, x'5269676874206c6576656c') > 0
            `;
            const rows = db.prepare(query).all();
            if (rows.length > 0) {
                console.log(`\nMatches in ${f}:`, rows.length);
                for (const row of rows) {
                    const data = db.prepare('SELECT DATA FROM cache WHERE KEY = ?').get(row.KEY);
                    if (data && data.DATA) {
                         const buf = data.DATA;
                         const idx = buf.indexOf(Buffer.from("ght level", "utf8")) - 2;
                         const start = Math.max(0, idx - 40);
                         const end = Math.min(buf.length, idx + 40);
                         console.log(`Archive ${row.KEY} Text: "${buf.toString('utf8', start, end).replace(/\n|\r|\0/g, ' ')}"`);
                    }
                }
            }
        } catch (e) {
            // some might not have cache table
        } finally {
            db.close();
        }
    }
}
searchAllCaches();


