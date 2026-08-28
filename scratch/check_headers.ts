import { GameCacheLoader } from '../src/cache/sqlite.ts';
import * as fs from 'fs';

async function main() {
    const cachePath = "C:\\ProgramData\\Jagex\\RuneScape-BETA";
    const loader = new GameCacheLoader(cachePath);
    const ids = [1404, 1922, 1929, 1946, 1947];
    for (const id of ids) {
        try {
            const buf = await loader.getFile(3, id);
            console.log(`Interface ${id}: first 10 bytes: ${buf.subarray(0, 10).toString('hex')}`);
        } catch (e) {
            console.log(`Interface ${id}: Failed to load: ${e.message}`);
        }
    }
}

main().catch(console.error);
