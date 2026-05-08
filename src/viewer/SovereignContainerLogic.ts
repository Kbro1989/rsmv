import { SovereignPersistence } from "./SovereignPersistence";

export interface ContainerSlot {
    slot: number;
    id: number;
    amount: number;
    name: string;
    stackable?: boolean;
}

export class SovereignContainerLogic {
    private static instance: SovereignContainerLogic;
    private manifest: any;

    private constructor() {}

    static async getInstance(): Promise<SovereignContainerLogic> {
        if (!SovereignContainerLogic.instance) {
            SovereignContainerLogic.instance = new SovereignContainerLogic();
            await SovereignContainerLogic.instance.initialize();
        }
        return SovereignContainerLogic.instance;
    }

    private async initialize() {
        this.manifest = await SovereignPersistence.importLegacySave();
    }

    getInventory(): ContainerSlot[] {
        return this.manifest.inventory || [];
    }

    getBank(): ContainerSlot[] {
        // Mocking the "Bank" substrate as 2026-era thick manifest logic
        // In a real manifest, this would be a separate "bank.json" or a large field
        return this.manifest.bank || [
            { slot: 0, id: 995, amount: 2147483647, name: "Coins" },
            { slot: 1, id: 57163, amount: 1, name: "First Necromancer's Robes" }
        ];
    }

    moveItem(from: "inventory" | "bank", to: "inventory" | "bank", slotIndex: number) {
        // Grounding the logic of item transfer
        console.log(`Sovereign: Transferring item from ${from} slot ${slotIndex} to ${to}`);
        // This would interact with SovereignPersistence in a full implementation
    }

    checkCapacity(container: "inventory" | "bank"): boolean {
        const capacity = container === "inventory" ? 28 : 1000;
        const current = container === "inventory" ? this.getInventory().length : this.getBank().length;
        return current < capacity;
    }
}
