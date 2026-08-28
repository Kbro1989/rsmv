import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../utils/logger';
import { getSovereignRoot, getPedagogyRoot } from '../../utils/SovereignPathResolver';

const logger = createLogger('BarrowsSynthesizer');

/**
 * Barrows Mechanical Sovereignty Synthesizer
 * Extracts deterministic rules (NPC spawning, state transitions)
 * from the pedagogical metadata for the Barrows region.
 */
async function synthesize() {
    const pedagogyPath = getPedagogyRoot();

    const atlasRoot = getSovereignRoot();
    const logicPath = path.join(atlasRoot, 'atlas', 'logic');

    if (!fs.existsSync(logicPath)) {
        fs.mkdirSync(logicPath, { recursive: true });
    }

    logger.info('Starting Barrows Mechanical Synthesis...');

    // Load datasets
    const npcs = JSON.parse(fs.readFileSync(path.join(pedagogyPath, 'npcs.json'), 'utf8'));
    const objects = JSON.parse(fs.readFileSync(path.join(pedagogyPath, 'objects.json'), 'utf8'));
    const taxonomic = JSON.parse(fs.readFileSync(path.join(pedagogyPath, 'taxonomic_synthesis.json'), 'utf8'));

    // Barrows Brothers Identification (Mechanical Ground Truth)
    const brothers = [
        { name: 'Dharok the Wretched', npc_id: 2025, sarcophagus_id: 6703, varbit: 1516 },
        { name: 'Ahrim the Blighted', npc_id: 2028, sarcophagus_id: 6707, varbit: 1521 },
        { name: 'Verac the Defiled', npc_id: 2030, sarcophagus_id: 6702, varbit: 1515 },
        { name: 'Torag the Corrupted', npc_id: 2029, sarcophagus_id: 6706, varbit: 1520 },
        { name: 'Karil the Tainted', npc_id: 2027, sarcophagus_id: 6705, varbit: 1519 },
        { name: 'Guthan the Infested', npc_id: 2026, sarcophagus_id: 6704, varbit: 1518 }
    ];

    // Extraction Logic: Sarcophagi to Brothers
    const sarcophagi = brothers.map(b => {
        return {
            object_id: b.sarcophagus_id,
            name: `${b.name.split(' ')[0]}'s Sarcophagus`,
            coords: getCoordsForObject(b.sarcophagus_id),
            trigger: 'click_sarcophagus',
            condition: `varbit_${b.varbit} == 0`,
            consequence: {
                action: 'spawn_npc',
                npc_id: b.npc_id
            }
        };
    });

    // Extraction Logic: State Machines (Varbits)
    const barrowsVarbits: Record<string, any> = {};
    for (const b of brothers) {
        const vKey = b.varbit.toString();
        if (taxonomic.varbits[vKey]) {
            barrowsVarbits[vKey] = {
                ...taxonomic.varbits[vKey],
                description: `${b.name} kill state`
            };
        } else {
            barrowsVarbits[vKey] = {
                npcs: [b.npc_id],
                objects: [b.sarcophagus_id],
                description: `${b.name} kill state (Heuristic)`
            };
        }
    }

    const barrowsLogic = {
        region: 'barrows',
        metadata: {
            extracted_at: new Date().toISOString(),
            source: 'Pedagogical Metadata + User Guidance'
        },
        sarcophagi,
        state_machines: {
            brother_kill_states: barrowsVarbits
        },
        loot_chest: {
            object_id: 6711,
            name: 'Rewards chest',
            coords: [3555, 3289, 0],
            unlock_condition: {
                type: 'all_brothers_defeated',
                required_varbits: brothers.map(b => b.varbit)
            }
        }
    };

    const outputPath = path.join(logicPath, 'barrows_logic.json');
    fs.writeFileSync(outputPath, JSON.stringify(barrowsLogic, null, 2));

    logger.info({ outputPath }, 'Barrows Mechanical Sovereignty synthesized and anchored.');
}

function getCoordsForObject(id: number): number[] {
    // Ground-truth coordinates for Barrows Sarcophagi (Tier 1 static mapping)
    const mapping: Record<number, number[]> = {
        6702: [3556, 3289, 0], // Verac
        6703: [3542, 3289, 0], // Dharok (approx)
        6704: [3556, 3301, 0], // Guthan (approx)
        6705: [3570, 3301, 0], // Karil (approx)
        6706: [3570, 3289, 0], // Torag (approx)
        6707: [3556, 3277, 0]  // Ahrim (approx)
    };
    return mapping[id] || [0, 0, 0];
}

synthesize().catch(err => {
    logger.error({ error: err.message }, 'Barrows Synthesis failed.');
});
