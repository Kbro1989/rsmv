import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\\\\ProgramData\\\\Jagex\\\\RuneScape";

async function hexSearch() {
    process.stdout.write("🔍 Searching for 'Globetrotter' in Item Archive...\n");
    const source = new GameCacheLoader(CACHE_DIR);
    
    try {
        const itemIndex = await source.getCacheIndex(cacheMajors.items);
        const encoder = new TextEncoder();
        const searchBuf1 = Buffer.from("Globetrotter");
        const searchBuf2 = Buffer.from("globetrotter");
        
        console.log(`Scanning ${itemIndex.length} archives...`);
        let found = 0;
        
        for (const archInfo of itemIndex) {
            if (!archInfo) continue;
            const arch = await source.getFileArchive(archInfo);
            for (const file of arch) {
                if (file.buffer.includes(searchBuf1) || file.buffer.includes(searchBuf2)) {
                    const id = (archInfo.minor << 8) | file.fileid;
                    console.log(`Found potential match in Item ID: ${id}`);
                    found++;
                }
            }
        }
        console.log(`Found ${found} matches.`);
    } finally {
        source.close();
    }
}

hexSearch().catch(console.error);


