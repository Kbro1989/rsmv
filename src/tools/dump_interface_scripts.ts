import { createRequire } from 'module';
import * as path from 'path';
const require = createRequire(import.meta.url);

import { GameCacheLoader } from '../cache/sqlite';
import { parse } from '../opdecoder';

async function main() {
    const cachePath = 'C:\\ProgramData\\Jagex\\RuneScape-BETA';
    const source = new GameCacheLoader(cachePath);
    
    console.log('Loading index for major 3...');
    const index = await source.getCacheIndex(3);
    
    const entry = index.find((q: any) => q && q.minor === 1496);
    if (!entry) {
        console.log('Interface 1496 not found in index');
        return;
    }
    
    console.log('Loading file archive for 1496...');
    const subfiles = await source.getFileArchive(entry);
    console.log(`Loaded ${subfiles.length} sub-files`);
    
    console.log('=== Parsing Components ===');
    let count = 0;
    for (let i = 0; i < subfiles.length; i++) {
        const sub = subfiles[i];
        try {
            const decoded = parse.interfaces.read(sub.buffer, source);
            
            let hasScripts = false;
            if (decoded.scripts) {
                for (const [key, val] of Object.entries(decoded.scripts)) {
                    if (Array.isArray(val) && val.length > 0) {
                        hasScripts = true;
                        break;
                    }
                }
            }
            
            if (hasScripts) {
                console.log(`\nSub-file ${i} (Component ${sub.fileid}):`);
                console.log('  Type:', decoded.type);
                console.log('  Scripts:', JSON.stringify(decoded.scripts, null, 2));
                count++;
                if (count >= 10) break; // Show only first 10
            }
        } catch (e) {
            // console.log(`Failed to parse sub-file ${i}:`, e.message);
        }
    }
}

main().catch(console.error);
