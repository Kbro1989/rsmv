import Database from "better-sqlite3";
import * as path from "path";

const DB_PATH = path.join(process.cwd(), "rsmvCacheDB.sqlite");

async function listGrounded() {
    console.log(`🔍 Listing Grounded Entities from ${DB_PATH}...`);
    const db = new Database(DB_PATH);
    
    const rows = db.prepare("SELECT * FROM grounded_entities").all();
    console.log(`Found ${rows.length} rows in database.`);
    rows.forEach((row: any) => {
        const c = Number(row.coord);
        
        // Formula A: Packed32 (plane << 28 | x << 14 | y)
        const xA = (c >> 14) & 0x3FFF;
        const yA = c & 0x3FFF;
        const pA = (c >> 28) & 0x3;

        // Formula B: CoordGrid (plane << 12 | x << 6 | y) - Zone relative
        const xB = (c >> 6) & 0x3F;
        const yB = c & 0x3F;
        const pB = (c >> 12) & 0x3;

        console.log(`[ENTITY] ID: ${row.id} Name: ${row.name}`);
        console.log(`  - A (Packed32): (${xA}, ${yA}, ${pA})`);
        console.log(`  - B (CoordGrid): (${xB}, ${yB}, ${pB})`);
        console.log(`  - Raw: ${c}`);
    });
    
    db.close();
}

listGrounded().catch(console.error);
