import { GameCacheLoader } from './src/cache/sqlite.js';
import { parse } from './src/opdecoder.js';
import { cacheMajors } from './src/constants.js';

async function verifyFrames() {
    console.log('--- Correlating Framemap Data with Frame AnimData ---');
    const cache = new GameCacheLoader('C:\\\\ProgramData\\\\Jagex\\\\RuneScape');
    
    // Get Framemap 0
    const fmIndex = await cache.getCacheIndex(cacheMajors.framemaps);
    const fmArch = await cache.getFileArchive(fmIndex[0]);
    const fmFile = fmArch.find(f => f.fileid === 0);
    const fm = parse.framemaps.read(fmFile!.buffer, cache);
    
    // Get Frame 11546 File 1
    const frIndex = await cache.getCacheIndex(cacheMajors.frames);
    const frArch = await cache.getFileArchive(frIndex[11546]);
    const frFile = frArch.find(f => f.fileid === 1);
    const fr = parse.frames.read(frFile!.buffer, cache);
    
    console.log(`Framemap 0 Data Length: ${fm.data.length}`);
    console.log(`Frame 11546 File 1 Flags Length: ${fr.flags.length}`);
    
    // Some frames have a flags length smaller than framemap data length, matching only up to highest modified transform.
    console.log('\n--- First 30 Mappings ---');
    for (let i = 0; i < 30; i++) {
        const flag = i < fr.flags.length ? fr.flags[i] : 0;
        const type = fm.data[i].type;
        console.log(`[${i}] Framemap type: ${type}, Frame flag: ${flag}`);
    }
    
    cache.close();
}

verifyFrames().catch(console.error);


