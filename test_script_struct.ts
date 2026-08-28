import { GameCacheLoader } from "./src/cache/sqlite";
import { parse } from "./src/opdecoder";
import { cacheMajors } from "./src/constants";

async function test() {
    const loader = new GameCacheLoader("C:\\ProgramData\\Jagex\\RuneScape");
    const table = loader.openTable(cacheMajors.clientscript);
    const row = await table.readFile(16441);
    if (!row || !row.DATA) return;
    const file = Buffer.from(row.DATA.buffer, row.DATA.byteOffset, row.DATA.byteLength);
    const script = parse.clientscript.read(file, loader) as any;
    console.log("Keys in script:", Object.keys(script));
    console.log("opcodedata:", script.opcodedata);
    loader.close();
}
test();
