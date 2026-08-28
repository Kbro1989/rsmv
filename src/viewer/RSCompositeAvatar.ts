import { EngineCache, ThreejsSceneCache } from "../3d/modeltothree";
import { RSModel, npcToModel } from "../3d/modelnodes";
import * as THREE from "three";

export class RSCompositeAvatar {
    public rootNode: THREE.Group = new THREE.Group();
    public rsModel: RSModel | null = null;
    public anims: Record<string, number> = {};
    
    constructor(private engine: EngineCache, private sceneCache: ThreejsSceneCache, public entityId: number = 15516) {
    }

    /**
     * Rebuilds the Sovereign Shell using the 2026 Composite Model Array + Color Replacements.
     */
    public async rebuildComposite(compositeData?: { 
        models: number[], 
        color_replacements?: [number, number][],
        material_replacements?: [number, number][] 
    }) {
        console.log(`RSEngine: Assembling Sovereign Shell [${this.entityId}]...`);
        
        // Ensure root cleanly setup
        this.rootNode.clear();
        this.rsModel?.cleanup();

        let modelIds = compositeData?.models || [];
        let mods: any = {};

        if (compositeData?.color_replacements) {
            mods.replaceColors = compositeData.color_replacements;
        }
        if (compositeData?.material_replacements) {
            mods.replaceMaterials = compositeData.material_replacements;
        }

        // If no composite data provided, fallback to the template NPC lookup
        if (modelIds.length === 0) {
            let npcInfo = await npcToModel(this.sceneCache, { id: this.entityId, head: false });
            if (npcInfo) {
                modelIds = npcInfo.models.map(m => m.modelid);
                this.anims = npcInfo.anims;
            }
        }

        if (modelIds.length === 0) {
            console.error(`Failed to load NPC ${this.entityId} template or provided models!`);
            return;
        }

        this.rsModel = new RSModel(this.sceneCache, modelIds.map(id => ({ modelid: id, mods })), `Sovereign_Avatar_${this.entityId}`, { noSkin: false });
        let loaded = await this.rsModel.model;
        
        // Attach raw rootmesh (no cloning so animations map correctly)
        this.rootNode.add(loaded.mesh);
        
        if (this.anims.default) {
            this.rsModel.setAnimation(this.anims.default);
        }
        
        console.log(`RSEngine: Avatar composite ${this.entityId} assembled and materialized!`);
    }
}
