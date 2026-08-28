import { ChunkData, MapRect } from "../3d/mapsquare";
import { EngineCache } from "../3d/modeltothree";
declare const depids: ("sequence" | "model" | "npc" | "frameset" | "enum" | "loc" | "texture" | "material" | "item" | "overlay" | "mapsquare" | "skeleton" | "animgroup" | "framebase" | "underlay")[];
export type DepTypes = typeof depids[number];
type DepArgs = {
    area?: MapRect;
} | undefined;
export type DependencyGraph = (typeof getDependencies) extends ((...args: any[]) => Promise<infer T>) ? T : never;
export declare function getDependencies(cache: EngineCache, args?: {}): Promise<{
    dependencyMap: Map<string, string[]>;
    dependentsMap: Map<string, string[]>;
    cascadeDependencies: (depname: string, list?: string[]) => string[];
    makeDeptName: (deptType: DepTypes, id: number) => string;
    hashDependencies: (depname: string, previouscrc?: number) => number;
    hasEntry: (deptType: DepTypes, depId: number) => boolean;
    insertMapChunk: (data: ChunkData) => string;
    preloadChunkDependencies: (args?: DepArgs) => Promise<void>;
}>;
export {};
