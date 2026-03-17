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
        readonly materialComplexity: number;
        readonly rigLogic: 'SKELETAL' | 'VERTEX_ANIM' | 'STATIC';
        readonly surfaceArea?: number;
    };
    readonly semantics: {
        readonly role: string;
        readonly race?: string;
        readonly intent: string; 
        readonly wikiUrl?: string;
    };
    readonly timestamp: number;
}
