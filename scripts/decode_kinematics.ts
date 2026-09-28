import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CACHE_DUMPS = 'D:/sovereign/cache_pedagogy/json_dumps';
const MEMORY_DIR = 'D:/sovereign/memory/pedagogy';

async function mapKinematicVectors() {
    console.log("== Sovereign Kinematic Vector Decoder ==");
    const objectsPath = resolve(CACHE_DUMPS, 'objects.json');
    const npcsPath = resolve(CACHE_DUMPS, 'npcs.json');
    
    // 1. Target CS2 script bindings mappings
    const scripts = {
        mouse: [3009, 3495, 5067, 11839],
        cart: [1383],
        keldagrim: [3715, 5828, 7164]
    };

    console.log("Loading Object and NPC schemas...");
    const objects = JSON.parse(readFileSync(objectsPath, 'utf8'));
    const npcs = JSON.parse(readFileSync(npcsPath, 'utf8'));

    const parsedMechanics = {
        carts: [] as any[],
        seekingNpcs: [] as any[],
        waypointBinders: [] as any[]
    };

    // Helper to find script bindings in params
    const hasScriptBinding = (params: any, scriptIds: number[]) => {
        if (!params) return false;
        return Object.values(params).some(val => 
            typeof val === 'number' && scriptIds.includes(val)
        );
    };

    // Parse Mine Cart object configurations
    for (const [idStr, objDef] of Object.entries<any>(objects)) {
        if (!objDef || (!objDef.name && !objDef.params)) continue;
        
        const isCart = objDef.name && objDef.name.toLowerCase().includes('cart');
        const bindsToCartScript = hasScriptBinding(objDef.params, scripts.cart) || hasScriptBinding(objDef.params, scripts.keldagrim);
        
        if (isCart || bindsToCartScript) {
            parsedMechanics.carts.push({
                id: parseInt(idStr),
                name: objDef.name,
                actions: objDef.actions,
                params: objDef.params,
                CS2_Link: bindsToCartScript ? 'Verified' : 'Potential'
            });
        }
    }

    // Parse Platypus / Toy Mouse / Patrol NPCs locomotion limits
    const seekingTerms = ['mouse', 'platypus', 'playtpus', 'bob'];
    for (const [idStr, npcDef] of Object.entries<any>(npcs)) {
        if (!npcDef || !npcDef.name) continue;
        
        const lowerName = npcDef.name.toLowerCase();
        const isSeeker = seekingTerms.some(t => lowerName.includes(t));
        const bindsToMouse = hasScriptBinding(npcDef.params, scripts.mouse);

        if (isSeeker || bindsToMouse) {
            parsedMechanics.seekingNpcs.push({
                id: parseInt(idStr),
                name: npcDef.name,
                walkRange: npcDef.walkRange || npcDef.walkSpeed, // Different cache dumps call it differently
                size: npcDef.size,
                params: npcDef.params,
                CS2_Link: bindsToMouse ? 'Verified' : 'Potential'
            });
        }
    }

    const outPath = resolve(MEMORY_DIR, 'kinematic_mechanics.json');
    writeFileSync(outPath, JSON.stringify(parsedMechanics, null, 2));

    console.log(`\n✅ Kinematic Vector mapping complete.`);
    console.log(`Extracted mechanics for ${parsedMechanics.carts.length} Cart nodes and ${parsedMechanics.seekingNpcs.length} Seeking NPCs.`);
    console.log(`Saved output to ${outPath}`);
}

mapKinematicVectors().catch(console.error);
