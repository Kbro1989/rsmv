import * as path from "path";

/**
 * Resolves the root directory of the Sovereign project (D:\sovereign)
 * and its memory/pedagogy subdirectories.
 */
export function getSovereignRoot(): string {
    return "D:\\sovereign";
}

export function getPedagogyRoot(): string {
    return path.join(getSovereignRoot(), "memory", "pedagogy");
}
