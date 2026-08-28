import { GameCacheLoader } from '../src/cache/sqlite.ts';
import { getrsmvCachePath } from '../src/utils/SovereignPathResolver.ts';
import * as path from 'path';

async function main() {
    const cachePath = "C:\\ProgramData\\Jagex\\RuneScape-BETA";
    const loader = new GameCacheLoader(cachePath);
    console.log('Fetching index for major 3...');
    const index = await loader.getCacheIndex(3);
    
    const ids = Object.keys(index).map(Number).sort((a, b) => a - b);
    console.log(`Found ${ids.length} interfaces.`);
    console.log(`Max ID: ${ids[ids.length - 1]}`);
    
    const highIds = ids.filter(id => id >= 1800);
    console.log(`High IDs (>= 1800): ${highIds.join(', ')}`);
}

main().catch(console.error);
