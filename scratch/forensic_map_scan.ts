import { GameCacheLoader } from '../src/cache/sqlite';
import { OpcodeReader } from '../src/opcode_reader';
import * as fs from 'fs';

async function forensicMapScan() {
    const loader = new GameCacheLoader('C:/ProgramData/Jagex/RuneScape');
    const index = await loader.getCacheIndex(5);
    
    // Testing specific regions: 8755 (Prif), 14131 (Barrows)
    const regions = [8755, 14131];
    
    for (const regionId of regions) {
        console.log(`\n--- Region ${regionId} ---`);
        const archive = index[regionId];
        if (!archive) continue;
        
        const files = await loader.getFileArchive(archive);
        for (const subfileId in files) {
            const buffer = files[subfileId].buffer;
            console.log(`Subfile ${subfileId}: ${buffer.length} bytes`);
            
            // Check for "jagx\01" magic (0x6a 61 67 78 01)
            // Or "0x6a" uint for magic
            if (buffer.length >= 4) {
                const magic = buffer.readUInt32BE(0);
                if (magic === 0x6a616778 || magic === 0x6a) {
                    console.log(`  [MATCH] Found magic header 0x${magic.toString(16)}!`);
                }
            }
        }
    }
}

forensicMapScan();
