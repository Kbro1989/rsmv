import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    const arch1404 = await loader.getArchiveById(cacheMajors.interfaces, 1404);
    console.log(`1404 sub-files: ${arch1404.length}`);
    console.log(`1404 fileids: ${arch1404.map(q => q.fileid).join(", ")}`);
    
    const arch1946 = await loader.getArchiveById(cacheMajors.interfaces, 1946);
    console.log(`1946 sub-files: ${arch1946.length}`);
    console.log(`1946 fileids: ${arch1946.map(q => q.fileid).join(", ")}`);
}

main().catch(console.error);
