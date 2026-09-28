import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Define the known types found in CS2/Enums based on Runescape reversing community knowledge
const TYPE_MAP: Record<number, string> = {
    0: 'Integer',
    1: 'Boolean',
    33: 'Skill (or small integer)',
    36: 'Coordinate/Vector3 (Packed)', 
    73: 'Item ID',
    105: 'Interface Component',
    110: 'NPC ID',
    111: 'Object ID',
    115: 'String',
    118: 'Struct/DBRow',
    119: 'DBTable',
    102: 'Font',
    // We will discover more as we analyze
};

function identifyType(typeCode: number): string {
    return TYPE_MAP[typeCode] || `Unknown(${typeCode})`;
}

async function analyzeEnums() {
    console.log("Loading enums.json...");
    const enumsPath = "D:\\sovereign\\cache_pedagogy\\json_dumps\\enums.json";
    
    let rawData: string;
    try {
        rawData = readFileSync(enumsPath, "utf-8");
    } catch (e) {
        console.error("Failed to load enums.json. Path correct?");
        return;
    }
    
    const enums = JSON.parse(rawData);
    const keys = Object.keys(enums);
    console.log(`Loaded ${keys.length} enums.`);
    
    const valTypeCounts: Record<number, number> = {};
    const keyTypeCounts: Record<number, number> = {};
    const interestingEnums: any[] = [];
    
    for (const [id, def] of Object.entries<any>(enums)) {
        valTypeCounts[def.valType] = (valTypeCounts[def.valType] || 0) + 1;
        keyTypeCounts[def.keyType] = (keyTypeCounts[def.keyType] || 0) + 1;
        
        // Let's identify enums mapping to NPCs (110) or Coordinates
        if (def.valType === 110 || TYPE_MAP[def.valType] === 'NPC ID') {
            if (Object.keys(def.map || {}).length > 0) {
                interestingEnums.push({ id, reason: "Maps to NPC IDs", sample: Object.entries(def.map).slice(0, 3) });
            }
        }
        
        // Scan for coordinate-like packed values if not statically typed
        if (def.map && typeof def.map === 'object') {
            const values = Object.values(def.map);
            if (values.some(v => typeof v === 'number' && v > 50000000 && v < 60000000)) {
                // Potential Coordinate
                interestingEnums.push({ id, reason: "Contains packed coordinates (50m+)", valType: def.valType, sample: Object.entries(def.map).slice(0, 2) });
            }
        }
    }
    
    console.log("\n--- Value Type Distribution ---");
    Object.entries(valTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            console.log(`Type ${type} (${identifyType(parseInt(type))}): ${count} enums`);
        });

    console.log("\n--- Key Type Distribution ---");
    Object.entries(keyTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
            console.log(`Type ${type} (${identifyType(parseInt(type))}): ${count} enums`);
        });
        
    console.log(`\n--- Found ${interestingEnums.length} Interesting Enums ---`);
    interestingEnums.slice(0, 10).forEach(ie => {
        console.log(`Enum ID: ${ie.id} | Reason: ${ie.reason}`);
        console.log(`  Sample Mapping: ${JSON.stringify(ie.sample)}`);
    });
}

analyzeEnums().catch(console.error);
