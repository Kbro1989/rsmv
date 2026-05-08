import * as fs from 'fs';
import { SovereignRosettaStone } from '../utils/SovereignRosettaStone';

export interface SovereignState {
    timestamp: string;
    origin: { x: number, z: number, plane: number };
    inventory: { id: number, amount: number, equipped?: boolean }[];
    skills: Record<string, { base: number, experience: number }>;
}

export class SovereignPersistence {
    private static STATE_PATH = 'D:\\sovereign\\memory\\sovereign_state.json';
    private static LEGACY_SAVE_PATH = 'D:\\sovereign\\memory\\pedagogy\\2004_save.json';

    /**
     * Loads the 2004 legacy save "pick_of_gods" and translates it to the 2026 baseline.
     */
    static async importLegacySave(): Promise<SovereignState | null> {
        try {
            if (!fs.existsSync(this.LEGACY_SAVE_PATH)) {
                console.warn(`[SOVEREIGN PERSISTENCE] Legacy save not found at ${this.LEGACY_SAVE_PATH}`);
                return null;
            }

            const legacyContent = fs.readFileSync(this.LEGACY_SAVE_PATH, 'utf-8');
            const legacySave = JSON.parse(legacyContent);

            console.log(`[SOVEREIGN PERSISTENCE] Reincarnating "pick_of_gods" (2004) into 2026 world...`);

            // Translate inventory using the Rosetta Stone
            const modernInventory = legacySave.inventory.map((item: any) => ({
                id: SovereignRosettaStone.translateItem(item.id),
                amount: item.amount || 1,
                equipped: item.equipped || false
            }));

            const state: SovereignState = {
                timestamp: new Date().toISOString(),
                origin: { x: 50, z: 50, plane: 1 }, // Forced Universal Baseline
                inventory: modernInventory,
                skills: legacySave.skills || {}
            };

            this.saveState(state);
            return state;
        } catch (e) {
            console.error(`[SOVEREIGN PERSISTENCE] Failed to import legacy save`, e);
            return null;
        }
    }

    static saveState(state: SovereignState) {
        try {
            fs.writeFileSync(this.STATE_PATH, JSON.stringify(state, null, 2));
            console.log(`[SOVEREIGN PERSISTENCE] State anchored at ${this.STATE_PATH}`);
        } catch (e) {
            console.error(`[SOVEREIGN PERSISTENCE] Failed to save state`, e);
        }
    }

    static loadState(): SovereignState | null {
        try {
            if (!fs.existsSync(this.STATE_PATH)) return null;
            return JSON.parse(fs.readFileSync(this.STATE_PATH, 'utf-8'));
        } catch (e) {
            return null;
        }
    }
}
