import * as fs from 'fs';
import * as path from 'path';
import { GameCacheLoader } from '../cache/sqlite';
import { cacheMajors, cacheConfigPages } from '../constants';
import { parse } from '../opdecoder';

const VARBIT_OUT_DIR = "D:\\sovereign\\memory\\pedagogy\\varbits";

export class SovereignVarbitBridge {
    private static instance: SovereignVarbitBridge;
    private cache: GameCacheLoader;

    private constructor() {
        this.cache = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
        if (!fs.existsSync(VARBIT_OUT_DIR)) {
            fs.mkdirSync(VARBIT_OUT_DIR, { recursive: true });
        }
    }

    static getInstance() {
        if (!this.instance) this.instance = new SovereignVarbitBridge();
        return this.instance;
    }

    /**
     * Extracts a varbit from the "Godhead" cache and saves it to pedagogy.
     */
    async extractVarbit(id: number) {
        const outPath = path.join(VARBIT_OUT_DIR, `vb_${id}.json`);
        
        // Skip if already extracted
        if (fs.existsSync(outPath)) return;

        try {
            console.log(`[GODHEAD] Synthesizing Varbit ${id}...`);
            const entry = await this.cache.getIndexEntryById(cacheMajors.config, cacheConfigPages.varbits);
            if (!entry) throw new Error("Varbit config page not found");

            const arch = await this.cache.getFileArchive(entry);
            const file = arch.find(f => f.fileid === id);
            
            if (file) {
                const varbitDef = (parse as any).varbits.read(file.buffer, this.cache);
                fs.writeFileSync(outPath, JSON.stringify(varbitDef, null, 2));
                console.log(`[GODHEAD] Resolved Varbit ${id}: BaseVar ${varbitDef.basevar}, ${varbitDef.bitsbins[0]}-${varbitDef.bitsbins[1]}`);
                return varbitDef;
            }
        } catch (e) {
            console.error(`  [ERR] Godhead Varbit Extraction Failed for ID ${id}:`, e);
        }
    }

    /**
     * Batch extraction for a set of IDs found in a region.
     */
    async batchExtract(ids: number[]) {
        for (const id of ids) {
            await this.extractVarbit(id);
        }
    }

    close() {
        this.cache.close();
    }
}
