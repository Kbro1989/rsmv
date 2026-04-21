import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";

async function fastSearch() {
    process.stdout.write("🔍 FAST Searching for 'level' constraints in Cache...\n");
    const source = new GameCacheLoader(CACHE_DIR);
    
    // We'll search scripts (12), enums (17), configs (2)
    const majorsToSearch = [cacheMajors.clientscript, cacheMajors.enums, cacheMajors.config];
    
    const searches = [
        Buffer.from("wrong level"),
        Buffer.from("Wrong level"),
        Buffer.from("right level"),
        Buffer.from("Right level")
    ];
    
    try {
        for (const major of majorsToSearch) {
            console.log(`Scanning Major ${major}...`);
            const index = await source.getCacheIndex(major);
            let found = 0;
            
            for (const archInfo of index) {
                if (!archInfo) continue;
                const arch = await source.getFileArchive(archInfo);
                for (const file of arch) {
                    for (const needle of searches) {
                        const idx = file.buffer.indexOf(needle);
                        if (idx !== -1) {
                            const id = (archInfo.minor << 8) | file.fileid;
                            console.log(`\nMatch found in Major ${major}, Arch ${archInfo.minor}, File ${file.fileid}`);
                            const start = Math.max(0, idx - 40);
                            const end = Math.min(file.buffer.length, idx + 40);
                            console.log(`   Text: "${file.buffer.toString('utf8', start, end).replace(/\n|\r/g, ' ')}"`);
                            found++;
                            break; // Stop checking this file if found
                        }
                    }
                }
            }
            console.log(`Major ${major} had ${found} matches.`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        source.close();
    }
}

fastSearch().catch(console.error);

