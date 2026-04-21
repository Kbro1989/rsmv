import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";

async function fastEnumSearch() {
    process.stdout.write("🔍 FAST Searching ENUMs & CONFIGs for 'level' constraints in Cache...\n");
    const source = new GameCacheLoader(CACHE_DIR);
    
    // We'll search scripts (12), enums (17), configs (2)
    const majorsToSearch = [cacheMajors.enums, cacheMajors.config, cacheMajors.items, cacheMajors.objects];
    
    // Searching case insensitively
    const bufNeedle1 = Buffer.from("level");
    const bufNeedle2 = Buffer.from("Level");
    
    try {
        for (const major of majorsToSearch) {
            console.log(`Scanning Major ${major}...`);
            const index = await source.getCacheIndex(major);
            let found = 0;
            
            for (const archInfo of index) {
                if (!archInfo) continue;
                const arch = await source.getFileArchive(archInfo);
                for (const file of arch) {
                    if (file.buffer.indexOf(bufNeedle1) !== -1 || file.buffer.indexOf(bufNeedle2) !== -1) {
                        const dataStr = file.buffer.toString('utf8');
                        const lower = dataStr.toLowerCase();
                        if (lower.includes("not at the right level") || lower.includes("on the correct level") || lower.includes("right level") || lower.includes("wrong level")) {
                            console.log(`\nMatch found in Major ${major}, Arch ${archInfo.minor}, File ${file.fileid}`);
                            // Find context
                            const idx = lower.indexOf("level");
                            const start = Math.max(0, idx - 40);
                            const end = Math.min(lower.length, idx + 40);
                            console.log(`   Text Context: "${dataStr.substring(start, end).replace(/\n|\r|\0/g, ' ')}"`);
                            found++;
                        }
                    }
                }
            }
            console.log(`Major ${major} had ${found} exact phrase matches.`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        source.close();
    }
}

fastEnumSearch().catch(console.error);

