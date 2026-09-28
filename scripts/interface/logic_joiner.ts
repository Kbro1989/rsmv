import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = join(process.cwd(), 'public');
const TABLES_DIR = 'D:/sovereign/atlas/logic/tables';
const MANIFEST_PATH = join(PUBLIC_DIR, 'authentic_spawn_manifest.json');
const OUTPUT_MANIFEST = join(PUBLIC_DIR, 'authentic_spawn_manifest.json');

async function main() {
    console.log("== Sovereign Logic Joiner (Kinematic & Probe Enrichment) ==");

    if (!existsSync(MANIFEST_PATH)) {
        console.error("Grounding manifest missing.");
        return;
    }

    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    const entities = manifest.entities || [];

    const targetIds = {
        npc: [7015, 7016, 7017, 7018, 7019, 7020, 7021, 7022, 7023, 7024, 7025, 7026, 9304, 9305, 9306, 901, 3597, 3495],
        object: [28094, 637, 90898, 90899, 90900, 90901, 131591]
    };

    const probeIds = [3597, 7015]; // Toy Mouse and Platypus

    // 1. Logic Injection for Probes & Mechanical Constants
    entities.forEach((entity: any) => {
        // Platypus Mechanical Truth (Impassable Collision)
        if (entity.entityId === 7015 || (entity.title && entity.title.toLowerCase().includes('platypus'))) {
            entity.mechanical = {
                collision: "impassable",
                boundSize: 1,
                role: "anchor"
            };
        }

        // Toy Mouse Mechanical Truth (Passable)
        if (entity.entityId === 3597) {
            entity.mechanical = {
                collision: "passable",
                role: "scout"
            };
        }

        // Flag as Forensic Probe
        if (probeIds.includes(entity.entityId) || (entity.title && (entity.title.toLowerCase().includes('mouse') || entity.title.toLowerCase().includes('platypus')))) {
            entity.isForensicProbe = true;
            entity.probeCapabilities = ["bumper_id", "door_interaction", "vertical_transversal"];
        }
    });

    // 2. DB Table Enrichment (Heuristic)
    const logicMap: any = {};
    if (existsSync(TABLES_DIR)) {
        const tables = readdirSync(TABLES_DIR).filter(f => f.endsWith('.json'));
        console.log(`Scanning ${tables.length} DB Tables for additional kinematic state...`);
        
        for (const tableFile of tables) {
            const tableData = JSON.parse(readFileSync(join(TABLES_DIR, tableFile), 'utf8'));
            for (const row of tableData) {
                const columnData = row.unk01?.columndata || [];
                const matchedCol = columnData.find((c: any) => 
                     c.value && c.value.some((v: any) => targetIds.npc.includes(v) || targetIds.object.includes(v))
                );

                if (matchedCol) {
                    const kinematics: any = { table: tableFile, params: {} };
                    columnData.forEach((c: any) => {
                        if (c.id !== undefined && c.value) kinematics.params[c.id] = c.value[0];
                    });

                    // Map specific properties
                    const routeIndex = kinematics.params[45] || kinematics.params[769] || kinematics.params[11];
                    const wanderRange = kinematics.params[394] || kinematics.params[3];

                    if (routeIndex !== undefined) kinematics.routeIndex = routeIndex;
                    if (wanderRange !== undefined) kinematics.wanderRange = wanderRange;

                    logicMap[row.id] = kinematics;
                }
            }
        }
    }

    // 3. Final Merge
    let enrichedCount = 0;
    entities.forEach((entity: any) => {
        const logic = logicMap[entity.entityId];
        if (logic) {
            entity.kinematics = { ...entity.kinematics, ...logic };
            enrichedCount++;
        }
    });

    writeFileSync(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2));
    console.log(`✅ Enrichment Complete. ${enrichedCount} nodes mapped with Kinematic Truth.`);
    console.log(`✅ Probes Flagged: ${entities.filter((e:any)=>e.isForensicProbe).length} entities.`);
}

main().catch(console.error);
