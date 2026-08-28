import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";

async function main() {
    const loader = new GameCacheLoader();
    const arch = await loader.getArchiveById(3, 1946);
    const sub = arch[0];
    const buf = sub.buffer;
    
    let line = "";
    for (let i = 0; i < buf.length; i++) {
        line += buf[i].toString(16).padStart(2, "0") + " ";
        if ((i + 1) % 16 === 0) {
            console.log(`${(i - 15).toString(10).padStart(3, " ")}: ${line}`);
            line = "";
        }
    }
    if (line) console.log(`${(buf.length - line.split(" ").length + 1).toString(10).padStart(3, " ")}: ${line}`);
}

main().catch(console.error);
