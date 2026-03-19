/**
 * Surrogate PedagogyProfile for headless substrate.
 */
export interface PedagogyProfile {
    readonly id: string;
    readonly name: string;
    readonly type: 'NPC' | 'OBJECT' | 'ITEM';
    readonly metrics: {
        readonly polyCount: number;
        readonly boneCount: number;
        readonly nodeCount: number;
        readonly jointCount: number;
        readonly materialComplexity: number;
        readonly rigLogic: 'SKELETAL' | 'VERTEX_ANIM' | 'STATIC';
        readonly surfaceArea?: number;
        readonly dimensions?: { x: number, y: number, z: number };
    };
    materials?: string[];
    semantic?: {
        name?: string;
        examine?: string;
        actions?: string[];
        combatLevel?: number;
        animationGroup?: number;
    };
    mechanics?: {
        params?: any;
        scriptOps?: string[];
        archetype?: string;
    };
    structure?: {
        readonly meshCount: number;
        readonly animationCount: number;
        readonly nodeHierarchyDepth?: number;
        readonly bones: string[];
        readonly materials: { name: string, type: string }[];
        joints?: any[];
        nodes?: any[];
        bounds?: { min: number[], max: number[] };
    };
    readonly semantics: {
        readonly role: string;
        readonly race?: string;
        readonly intent: string; 
        readonly wikiUrl?: string;
    };
    readonly timestamp: number;
}
