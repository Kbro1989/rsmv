import { GameCacheLoader } from "../src/cache/sqlite";
import { cacheMajors } from "../src/constants";
import { parse } from "../src/opdecoder";

async function main() {
    const loader = new GameCacheLoader();
    
    // Key interface IDs to audit
    const targets = [
        { id: 703, label: "Main HUD / Combat" },
        { id: 1420, label: "Character Creation" },
        { id: 1946, label: "Highest ID" },
        { id: 1321, label: "Clan Avatar" },
        { id: 1168, label: "Body/Avatar refs" },
        { id: 1496, label: "Settings (top scorer)" },
        { id: 1922, label: "Controls/Interface" },
        { id: 1433, label: "Settings/Controls" },
        { id: 1797, label: "Body ref" },
    ];
    
    for (const t of targets) {
        try {
            const arch = await loader.getArchiveById(cacheMajors.interfaces, t.id);
            let parsed = 0, failed = 0;
            const texts: string[] = [];
            const types: Record<string, number> = {};
            const scriptIds = new Set<number>();
            
            for (const sub of arch) {
                const state: any = {
                    isWrite: false, buffer: sub.buffer, stack: [], hiddenstack: [],
                    scan: 0, endoffset: sub.buffer.byteLength,
                    args: { ...loader.getDecodeArgs(), clientVersion: 1149 }
                };
                try {
                    const comp = parse.interfaces.parser.read(state);
                    parsed++;
                    const typeName = `type_${comp.type}`;
                    types[typeName] = (types[typeName] || 0) + 1;
                    if (comp.textdata?.text) texts.push(comp.textdata.text);
                    // Collect script IDs from load callback
                    if (comp.scripts?.load?.length > 0 && typeof comp.scripts.load[0] === 'number') {
                        scriptIds.add(comp.scripts.load[0]);
                    }
                } catch { failed++; }
            }
            
            console.log(`\n[${t.id}] ${t.label}: ${parsed}/${arch.length} parsed (${failed} errors)`);
            console.log(`  Types: ${JSON.stringify(types)}`);
            if (texts.length > 0) console.log(`  Texts: ${texts.slice(0, 8).join(' | ')}`);
            if (scriptIds.size > 0) console.log(`  Load scripts: ${[...scriptIds].join(', ')}`);
        } catch (e: any) {
            console.log(`\n[${t.id}] ${t.label}: NOT FOUND`);
        }
    }
}

main().catch(console.error);
