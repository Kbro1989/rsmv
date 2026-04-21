import { GameCacheLoader } from "../cache/sqlite";
import { cacheMajors } from "../constants";
import { parse } from "../opdecoder";
import { archiveToFileId } from "../cache";
import * as fs from "fs";

const CACHE_DIR = "C:\ProgramData\Jagex\RuneScape";
const targetObjectIds = new Set([
    129420, 129754, 129765, 129762, 129763, 129321, 
    129412, 129413, 129414, 129758, 129759, 129760
]);

const foundTargets = new Map<number, { id: number, x: number, y: number, z: number, plane: number, locName?: string }[]>();
const mappedSquares = new Set<number>();
const allObjectsInSquare = new Map<number, Set<number>>();

async function groundBloomingBurrow() {
    console.log("🧬 Scanning Global Grid for Blooming Burrow Anchors...");
    const source = new GameCacheLoader(CACHE_DIR);
    
    // Major 5 (Mapsquares)
    const index = await source.getCacheIndex(cacheMajors.mapsquares);
    
    let checkedCount = 0;
    
    for (const [archId, archInfo] of index.entries()) {
        if (!archInfo) continue;
        
        try {
            const arch = await source.getFileArchive(archInfo);
            for (const locFile of arch) {
               try {
                   const locs = parse.mapsquareLocations.read(locFile.buffer, source);
                   let targetFound = false;
                   for (const loc of locs.locations) {
                       if (targetObjectIds.has(loc.id)) {
                           targetFound = true;
                           const x = (archId >> 8) & 0xFF;
                           const y = archId & 0xFF;
                           for (const use of loc.uses) {
                               const worldX = (x * 64) + use.x;
                               const worldY = (y * 64) + use.y;
                               console.log(`🎯 [ANCHOR] ID ${loc.id} at [Square: ${x}, ${y}] World: (${worldX}, ${worldY}, ${use.plane})`);
                               
                               if (!foundTargets.has(x)) foundTargets.set(x, []);
                               foundTargets.get(x)!.push({ id: loc.id, x: worldX, y: worldY, z: 0, plane: use.plane });
                           }
                       }
                   }
                   if (targetFound) {
                       mappedSquares.add(archId);
                       // Save all unique object IDs in this chunk for the pedagogy tail
                       if (!allObjectsInSquare.has(archId)) allObjectsInSquare.set(archId, new Set());
                       for (const loc of locs.locations) {
                           allObjectsInSquare.get(archId)!.add(loc.id);
                       }
                   }
               } catch (e) {
                   // Not a location file
               }
            }
            checkedCount++;
            if (checkedCount % 500 === 0) process.stdout.write(".");
        } catch (e) { }
    }

    console.log(`\n🧬 Scanning Complete. Found anchors in ${mappedSquares.size} map squares.`);
    
    //
    // THE PEDAGOGY TAIL: Load Varbits for matched nodes
    //
    console.log("\n🐉 [TAIL] Extracting logic gates (Varbits/Varps) for related contents within the discovered nodes...");
    const objectIndex = await source.getCacheIndex(cacheMajors.objects);
    
    const nodeVarbits: any[] = [];
    
    // Cache for object archives to massively speed up the tail
    const objectArchiveCache = new Map<number, any[]>();
    
    for (const squareArchId of mappedSquares) {
        const x = (squareArchId >> 8) & 0xFF;
        const y = squareArchId & 0xFF;
        console.log(`\n  >> Interrogating Node [Square: ${x}, ${y}]...`);
        
        const objSet = allObjectsInSquare.get(squareArchId)!;
        let varbitsFound = 0;
        
        for (const objId of objSet) {
            const archiveId = Math.floor(objId / 256);
            const fileId = objId % 256;
            
            const objGroupInfo = objectIndex[archiveId];
            if (!objGroupInfo) continue;
            
            try {
                let arch = objectArchiveCache.get(archiveId);
                if (!arch) {
                    arch = await source.getFileArchive(objGroupInfo);
                    objectArchiveCache.set(archiveId, arch);
                }
                
                const file = arch.find(f => f.fileid === fileId);
                if (file) {
                    const obj = parse.object.read(file.buffer, source);
                    const morphs = obj.morphs_1 || obj.morphs_2;
                    if (morphs && morphs.unk1 !== undefined) {
                        const varbit = (morphs.unk1 >> 16) & 0xFFFF;
                        const varp = morphs.unk1 & 0xFFFF;
                        
                        // We filter out 65535 which usually means no varbit/varp is mapped to that half
                        const hasVarbit = varbit !== 65535;
                        const hasVarp = varp !== 65535;
                        
                        nodeVarbits.push({
                            chunkX: x,
                            chunkY: y,
                            objectId: objId,
                            objectName: obj.name,
                            varbit: hasVarbit ? varbit : null,
                            varp: hasVarp ? varp : null
                        });
                        varbitsFound++;
                    }
                }
            } catch (e) { }
        }
        console.log(`  << Found ${varbitsFound} logic gates attached to objects in node.`);
    }

    source.close();
    
    // Format output
    let report = "## Blooming Burrow Forensic Spatial & Logic Dump\n\n";
    report += "### 1. Discovered Anchor Coordinates\n";
    for (const [x, arr] of foundTargets.entries()) {
        report += `#### Grid X Base: ${x}\n`;
        const yGroups = [...new Set(arr.map(a => Math.floor(a.y / 64)))];
        report += `- Intersects Square Y bases: ${yGroups.join(", ")}\n`;
        report += `- Matches: ${arr.length} raw entity instances.\n`;
    }
    
    report += "\n### 2. Pedagogy Tail - Node Logic Gates (Varbits/Varps)\n";
    if (nodeVarbits.length === 0) {
        report += "No logic morphs found linked directly to objects in these nodes.\n";
    } else {
        const uniqueVarbits = new Set();
        const uniqueVarps = new Set();
        for (const node of nodeVarbits) {
            report += `- Object **${node.objectName || 'Unknown'}** (ID: ${node.objectId}) at Square [${node.chunkX}, ${node.chunkY}] -> `;
            const parts: string[] = [];
            if (node.varbit) { parts.push(`Varbit: ${node.varbit}`); uniqueVarbits.add(node.varbit); }
            if (node.varp) { parts.push(`Varp: ${node.varp}`); uniqueVarps.add(node.varp); }
            report += parts.join(" | ") + "\n";
        }
        
        report += `\n**Summary:** Discovered ${uniqueVarbits.size} unique varbits and ${uniqueVarps.size} unique varps operating within the Blooming Burrow environment.\n`;
    }
    
    fs.writeFileSync("blooming_burrow_anchors.txt", report);
    console.log("\n✅ Grounding & Pedagogy Tail Complete. Saved to blooming_burrow_anchors.txt");
}

groundBloomingBurrow().catch(console.error);

