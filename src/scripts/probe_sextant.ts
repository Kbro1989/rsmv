import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const SEXTANT_ID = 2574;

async function probeSextant() {
    console.log(`🔍 Probing Sextant (Item ${SEXTANT_ID})...`);
    const source = new GameCacheLoader(CACHE_DIR);
    
    const archId = SEXTANT_ID >> 8;
    const fileId = SEXTANT_ID & 0xFF;
    
    const archInfo = (await source.getCacheIndex(cacheMajors.items))[archId];
    const arch = await source.getFileArchive(archInfo);
    const file = arch.find(f => f.fileid === fileId);

    if (file) {
        console.log(`Found Sextant File. Decoding...`);
        const item = parse.item.read(file.buffer, source);
        console.log("Item Configuration:");
        console.log(JSON.stringify(item, null, 2));
        
        if (item.extra) {
            console.log("\nExtra Parameters (Opcode 249):");
            item.extra.forEach((p: any) => {
                console.log(`Prop ${p.prop}: ${p.intvalue || p.stringvalue}`);
            });
        }
    } else {
        console.log("Sextant file not found in archive.");
    }
    
    source.close();
}

probeSextant().catch(console.error);

