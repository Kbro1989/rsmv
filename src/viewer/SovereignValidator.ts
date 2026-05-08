import { SovereignPersistence } from "./SovereignPersistence";

export interface ValidationWarning {
    type: "LEVEL_REQ" | "SKILL_CAP" | "MISSING_DATA";
    item_name: string;
    requirement: string;
    current: string;
}

export class SovereignValidator {
    private static instance: SovereignValidator;
    private skillManifest: any;
    private equipReqs: any;

    private constructor() {}

    static async getInstance(): Promise<SovereignValidator> {
        if (!SovereignValidator.instance) {
            SovereignValidator.instance = new SovereignValidator();
            await SovereignValidator.instance.initialize();
        }
        return SovereignValidator.instance;
    }

    private async initialize() {
        try {
            // High-Performance Grounding: Use absolute filesystem access in Electron/Node
            if (typeof require !== "undefined") {
                const fs = require('fs');
                const path = require('path');
                const logicPath = "D:\\sovereign\\memory\\pedagogy\\logic\\";
                
                this.skillManifest = JSON.parse(fs.readFileSync(path.join(logicPath, "skill_manifest.json"), "utf8"));
                this.equipReqs = JSON.parse(fs.readFileSync(path.join(logicPath, "equipment_requirements.json"), "utf8"));
                console.log("SovereignValidator: Logic substrates grounded successfully via FS.");
            } else {
                console.warn("SovereignValidator: Not in a Node/Electron environment; grounding deferral active.");
            }
        } catch (e) {
            console.error("SovereignValidator: Failed to ground logic substrates.", e);
        }
    }

    async validateManifest(saveData: any): Promise<ValidationWarning[]> {
        const warnings: ValidationWarning[] = [];
        if (!saveData || !saveData.skills) return warnings;

        // Check Equipment Level Reqs
        if (saveData.equipment) {
            for (const item of saveData.equipment) {
                const warning = this.checkItemRequirement(item, saveData.skills);
                if (warning) warnings.push(warning);
            }
        }

        return warnings;
    }

    private checkItemRequirement(item: any, skills: any): ValidationWarning | null {
        // Mock logic: In a full substrate, we'd lookup item.id in the Materialized Substrate.
        // Here we use the "Typical Tiering" based on name or metadata for grounding.
        const name = item.name.toLowerCase();
        
        // Example: "Black" items require Level 10 Attack/Defence.
        if (name.includes("black")) {
            const atk = skills["Attack"]?.base || 1;
            const def = skills["Defence"]?.base || 1;
            if (atk < 10) return { type: "LEVEL_REQ", item_name: item.name, requirement: "10 Attack", current: `${atk}` };
            if (def < 10) return { type: "LEVEL_REQ", item_name: item.name, requirement: "10 Defence", current: `${def}` };
        }

        // Example: "Skull lantern" (Necro T1-40-60-70-80-90-95)
        if (name.includes("skull lantern")) {
            const necro = skills["Necromancy"]?.base || 1;
            // Let's assume the manifest 2004_save.json version is T10
            if (necro < 10) return { type: "LEVEL_REQ", item_name: item.name, requirement: "10 Necromancy", current: `${necro}` };
        }

        return null;
    }
}
