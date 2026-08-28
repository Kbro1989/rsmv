import { avataroverrides } from "../../generated/avataroverrides";
import { avatars } from "../../generated/avatars";
import { EngineCache } from "./modeltothree";
import { npcs } from "../../generated/npcs";
export declare function avatarStringToBytes(text: string): Buffer<ArrayBuffer>;
export declare function bytesToAvatarString(buf: Buffer): string;
export declare function lowname(name: string): string;
export declare const slotNames: string[];
export declare const slotToKitMale: {
    4: number;
    6: number;
    7: number;
    8: number;
    9: number;
    10: number;
    11: number;
};
export declare const slotToKitFemale: {
    4: number;
    6: number;
    7: number;
    8: number;
    9: number;
    10: number;
};
export type EquipCustomization = avataroverrides["slots"][number]["cust"];
export type EquipSlot = {
    name: string;
    type: "kit" | "item";
    id: number;
    models: number[];
    headmodels: number[];
    replaceMaterials: [number, number][];
    replaceColors: [number, number][];
    animStruct: number;
};
export declare function avatarToModel(engine: EngineCache, buffer: Buffer, head: boolean): Promise<import("./modelnodes").SimpleModelInfo<{
    avatar: avataroverrides | null;
    gender: number;
    npc: npcs | null;
    kitcolors: Record<"hair" | "feet" | "skin" | "clothes", Record<number, number>>;
    buffer: Buffer<ArrayBufferLike>;
}, Buffer<ArrayBufferLike>>>;
export declare function writeAvatar(avatar: avataroverrides | null, gender: number, npc: avatars["npc"]): Buffer<ArrayBufferLike>;
export declare function appearanceUrl(name: string): string;
