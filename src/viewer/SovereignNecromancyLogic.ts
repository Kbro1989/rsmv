import { SovereignPersistence } from "./SovereignPersistence";

/**
 * Cache-grounded SpotAnim reference for a Necromancy ability.
 * These IDs are materialized from Major 21 (spotanims) and Major 20 (sequences).
 */
export interface NecromancyGFX {
    spotAnimId: number;
    modelId: number;
    sequenceId: number;
    /** If true, the GFX uses unk2e rendering (billboard/additive blend). */
    additiveBlend: boolean;
}

export interface NecromancyAbility {
    id: string;
    name: string;
    type: "basic" | "conjure" | "finisher" | "utility";
    adrenaline_gain?: number;
    adrenaline_cost?: number;
    rotation_weight: number;
    /** Cache-grounded GFX reference. Null if no visual effect. */
    gfx: NecromancyGFX | null;
    /** Frame archive ID (frameidhi) for the animation skeleton. */
    frameArchive?: number;
    /** Total animation duration in game ticks (each framelength unit = 1 tick). */
    animDurationTicks?: number;
}

/**
 * Scythe SpotAnim mapping materialized from the RuneScape cache.
 * Range 4577-4594, using 4 distinct models and 18 sequences.
 *
 * Model groups:
 *   93729 - Cast/summon GFX (4577)
 *   79067 - Sweep phase A (4578-4582)
 *   93732 - Sweep phase B (4583-4586)
 *   93731 - Impact/hit GFX with additive blend (4587-4594)
 */
const SCYTHE_SPOTANIMS: Record<string, NecromancyGFX> = {
    cast:     { spotAnimId: 4577, modelId: 93729, sequenceId: 22729, additiveBlend: false },
    sweep_1:  { spotAnimId: 4578, modelId: 79067, sequenceId: 22730, additiveBlend: false },
    sweep_2:  { spotAnimId: 4580, modelId: 79067, sequenceId: 22732, additiveBlend: false },
    sweep_3:  { spotAnimId: 4581, modelId: 79067, sequenceId: 22733, additiveBlend: false },
    sweep_4:  { spotAnimId: 4582, modelId: 79067, sequenceId: 22734, additiveBlend: false },
    arc_1:    { spotAnimId: 4583, modelId: 93732, sequenceId: 22735, additiveBlend: false },
    arc_2:    { spotAnimId: 4584, modelId: 93732, sequenceId: 22736, additiveBlend: false },
    arc_3:    { spotAnimId: 4585, modelId: 93732, sequenceId: 22737, additiveBlend: false },
    arc_4:    { spotAnimId: 4586, modelId: 93732, sequenceId: 22738, additiveBlend: false },
    impact_1: { spotAnimId: 4587, modelId: 93731, sequenceId: 22718, additiveBlend: true },
    impact_2: { spotAnimId: 4588, modelId: 93731, sequenceId: 22719, additiveBlend: true },
    impact_3: { spotAnimId: 4589, modelId: 93731, sequenceId: 22720, additiveBlend: true },
    impact_4: { spotAnimId: 4590, modelId: 93731, sequenceId: 22721, additiveBlend: true },
    impact_5: { spotAnimId: 4591, modelId: 93731, sequenceId: 22722, additiveBlend: true },
    impact_6: { spotAnimId: 4592, modelId: 93731, sequenceId: 22723, additiveBlend: true },
    impact_7: { spotAnimId: 4593, modelId: 93731, sequenceId: 22724, additiveBlend: true },
    impact_8: { spotAnimId: 4594, modelId: 93731, sequenceId: 22725, additiveBlend: true },
};

/**
 * Frame archive IDs for the scythe animation skeletons.
 * Derived from frameidhi in the materialized sequences.
 */
const SCYTHE_FRAME_ARCHIVES = {
    impact: 3529,   // SEQ 22718-22725
    cast: 3531,     // SEQ 22729
    sweep: 3530,    // SEQ 22730
    arc_a: 3550,    // SEQ 22735-22736
    arc_b: 3540,    // SEQ 22737
    arc_c: 3541,    // SEQ 22738
};

export class SovereignNecromancyLogic {
    private static instance: SovereignNecromancyLogic;
    private state: any = null;
    private activeGFX: NecromancyGFX | null = null;

    private constructor() {}

    public static async getInstance(): Promise<SovereignNecromancyLogic> {
        if (!this.instance) {
            this.instance = new SovereignNecromancyLogic();
            await this.instance.refreshState();
        }
        return this.instance;
    }

    public async refreshState() {
        this.state = await SovereignPersistence.importLegacySave();
        console.log("[SOVEREIGN LOGIC] Necromancy State Synchronized.");
    }

    public getCombatState() {
        return this.state?.combat_state || {
            adrenaline: 0,
            necrosis_stacks: 0,
            residual_souls: 0
        };
    }

    public getActiveGFX(): NecromancyGFX | null {
        return this.activeGFX;
    }

    /**
     * Returns the scythe spotanim map for external consumers (HUD, renderer).
     */
    public getScytheGFX(): Record<string, NecromancyGFX> {
        return SCYTHE_SPOTANIMS;
    }

    /**
     * Logic for "Finger of Death" empowerment.
     * Cost is reduced by 10% per Necrosis stack.
     */
    public getFingerOfDeathCost(): number {
        const stacks = this.getCombatState().necrosis_stacks;
        const baseCost = 60; // 60% adrenaline
        const reduction = stacks * 10;
        return Math.max(0, baseCost - reduction);
    }

    /**
     * Logic for "Volley of Souls".
     * Consumes all Residual Souls.
     */
    public canVolley(): boolean {
        return this.getCombatState().residual_souls > 0;
    }

    /**
     * Apply an ability and trigger the associated GFX.
     * The GFX reference is cache-grounded — the spotAnimId, modelId, and sequenceId
     * are all real IDs from the materialized pedagogy substrate.
     */
    public async applyAbility(abilityId: string) {
        console.log(`[SOVEREIGN MOTOR] Applying Necromancy Ability: ${abilityId}`);
        const combat = this.state.combat_state;

        switch (abilityId) {
            case "touch":
            case "touch_of_death":
                combat.necrosis_stacks = Math.min(12, (combat.necrosis_stacks || 0) + 2);
                combat.adrenaline = Math.min(100, (combat.adrenaline || 0) + 9);
                this.activeGFX = SCYTHE_SPOTANIMS.cast;
                console.log(`  [GFX] SpotAnim ${this.activeGFX.spotAnimId} → Model ${this.activeGFX.modelId}, Seq ${this.activeGFX.sequenceId}`);
                break;

            case "finger":
            case "finger_of_death":
                const cost = this.getFingerOfDeathCost();
                if (combat.adrenaline >= cost) {
                    combat.adrenaline -= cost;
                    combat.necrosis_stacks = 0; // consumed
                    this.activeGFX = SCYTHE_SPOTANIMS.impact_1;
                    console.log(`  [GFX] SpotAnim ${this.activeGFX.spotAnimId} → Model ${this.activeGFX.modelId} (ADDITIVE), Seq ${this.activeGFX.sequenceId}`);
                }
                break;

            case "sap":
            case "soul_sap":
                combat.residual_souls = Math.min(5, (combat.residual_souls || 0) + 1);
                combat.adrenaline = Math.min(100, (combat.adrenaline || 0) + 9);
                this.activeGFX = SCYTHE_SPOTANIMS.sweep_1;
                console.log(`  [GFX] SpotAnim ${this.activeGFX.spotAnimId} → Model ${this.activeGFX.modelId}, Seq ${this.activeGFX.sequenceId}`);
                break;

            case "volley":
            case "volley_of_souls":
                if (this.canVolley()) {
                    const souls = combat.residual_souls;
                    combat.residual_souls = 0;
                    // Each soul triggers a separate impact GFX
                    const impactKeys = Object.keys(SCYTHE_SPOTANIMS).filter(k => k.startsWith("impact_"));
                    for (let i = 0; i < Math.min(souls, impactKeys.length); i++) {
                        const gfx = SCYTHE_SPOTANIMS[impactKeys[i]];
                        console.log(`  [GFX] Volley Soul ${i + 1}/${souls}: SpotAnim ${gfx.spotAnimId} → Model ${gfx.modelId} (ADDITIVE), Seq ${gfx.sequenceId}`);
                    }
                    this.activeGFX = SCYTHE_SPOTANIMS.impact_1;
                }
                break;

            case "death_grasp":
                // Uses the full scythe sweep → arc → impact chain
                this.activeGFX = SCYTHE_SPOTANIMS.cast;
                console.log(`  [GFX] Cast: SpotAnim ${SCYTHE_SPOTANIMS.cast.spotAnimId} → Model ${SCYTHE_SPOTANIMS.cast.modelId}`);
                console.log(`  [GFX] Sweep: SpotAnim ${SCYTHE_SPOTANIMS.sweep_1.spotAnimId} → Model ${SCYTHE_SPOTANIMS.sweep_1.modelId}`);
                console.log(`  [GFX] Arc: SpotAnim ${SCYTHE_SPOTANIMS.arc_1.spotAnimId} → Model ${SCYTHE_SPOTANIMS.arc_1.modelId}`);
                console.log(`  [GFX] Impact: SpotAnim ${SCYTHE_SPOTANIMS.impact_1.spotAnimId} → Model ${SCYTHE_SPOTANIMS.impact_1.modelId} (ADDITIVE)`);
                combat.adrenaline = Math.min(100, (combat.adrenaline || 0) + 15);
                break;

            case "conj_skel":
            case "conj_zomb":
            case "conj_ghst":
                // Conjure abilities don't consume/generate combat resources
                this.activeGFX = null;
                break;

            default:
                console.warn(`[SOVEREIGN LOGIC] Unknown ability: ${abilityId}`);
                this.activeGFX = null;
        }

        // Auto-clear GFX after 3 seconds (simulating animation duration)
        if (this.activeGFX) {
            setTimeout(() => { this.activeGFX = null; }, 3000);
        }
    }
}
