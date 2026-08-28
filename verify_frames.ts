import { GameCacheLoader } from './src/cache/sqlite.js';
import { parse } from './src/opdecoder.js';
import { cacheMajors } from './src/constants.js';

async function verifyFrames() {
    console.log('--- Verifying Frame 11546 (Sequence 18019 / Spirit Cyrisus) ---');
    const cache = new GameCacheLoader('C:\\\\ProgramData\\\\Jagex\\\\RuneScape');
    
    // Frames are Major 48. Arch ID is frameidhi (11546)
    const frIndex = await cache.getCacheIndex(cacheMajors.frames);
    const frArchId = 11546;
    if (!frIndex[11546]) {
        console.error('Frame archive 11546 not found');
        cache.close();
        return;
    }
    const frArch = await cache.getFileArchive(frIndex[11546]);
    
    // We get file 1 (the first file of seq 18019)
    const frFile = frArch.find(f => f.fileid === 1);
    if (!frFile) {
        console.error('Frame archive 11546 file 1 not found');
        cache.close();
        return;
    }
    
    const fr = parse.frames.read(frFile.buffer, cache);
    console.log('Frame 11546 File 1 probably_framemap_id:', fr.probably_framemap_id);
    console.log('Flags length:', fr.flags.length);
    console.log('Animdata length:', fr.animdata.length);
    
    // Fetch the framemap (Major 1)
    const fmIndex = await cache.getCacheIndex(cacheMajors.framemaps);
    const fmId = fr.probably_framemap_id;
    // Let's check where the framemap is stored. Usually archive ID = floor(fmId / 128)?? Wait, framemaps might be group 0, file fmId.
    // Or group fmId, file 0. Let's try both.
    let fmArch = null;
    let fmFile = null;

    // Try finding it directly in archive fmId
    if (fmIndex[fmId]) {
        const arch = await cache.getFileArchive(fmIndex[fmId]);
        // Usually framemaps only have file 0
        fmFile = arch.find(f => f.fileid === 0);
        if (fmFile) console.log('Found framemap as Archive', fmId, 'File 0');
    }

    if (!fmFile && fmIndex[Math.floor(fmId / 128)]) {
        const arch = await cache.getFileArchive(fmIndex[Math.floor(fmId/128)]);
        fmFile = arch.find(f => f.fileid === (fmId % 128));
        if (fmFile) console.log('Found framemap as Archive', Math.floor(fmId/128), 'File', fmId % 128);
    }

    if (!fmFile && fmIndex[0]) {
        const arch = await cache.getFileArchive(fmIndex[0]);
        fmFile = arch.find(f => f.fileid === fmId);
        if (fmFile) console.log('Found framemap as Archive 0, File', fmId);
    }
    
    if (fmFile) {
        const fm = parse.framemaps.read(fmFile.buffer, cache);
        console.log('Framemap', fmId, 'Skeleton Length:', fm.skeleton.length);
        console.log('Flags matches Skeleton length:', fr.flags.length === fm.skeleton.length);
        
        // Print first 10 skeleton bones
        console.log('SKELETON (first 10):');
        fm.skeleton.slice(0, 10).forEach((b: any, i: number) => {
            console.log(`  [${i}] skin_id: ${b.nonskinboneid}, type: ${b.transform_type}, flag_in_anim: ${fr.flags[i]}`);
        });
    } else {
        console.log('Framemap file not found.');
    }
    
    cache.close();
}

verifyFrames().catch(console.error);


