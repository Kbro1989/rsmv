import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function bruteForce() {
    console.log("🚀 Sovereign Brute Force Admin Scan — Raw String Forensic");
    const source = new GameCacheLoader(CACHE_DIR);
    const table = source.openTable(cacheMajors.clientscript);
    
    const hits: Record<number, string[]> = {};
    const targets = ["::", ";;", "tele ", "setvar ", "getvar "];

    for (let id = 0; id < 25000; id++) {
        try {
            const row = await table.readFile(id);
            if (!row || !row.DATA) continue;
            
            const buf = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
            const found = targets.filter(t => buf.includes(Buffer.from(t, 'utf8')));
            
            if (found.length > 0) {
                hits[id] = found;
                // console.log(`🎯 Hit in Script ${id}: ${found.join(", ")}`);
            }
        } catch (e) {}
        if (id % 5000 === 0) console.log(`   Processed ${id}...`);
    }

    console.log(`✅ Scan Complete. Found ${Object.keys(hits).length} potential scripts.`);
    console.log(JSON.stringify(hits, null, 2));
    source.close();
}

bruteForce().catch(console.error);


