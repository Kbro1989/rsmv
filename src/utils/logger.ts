/**
 * Simple logger utility for Sovereign synthesis scripts
 */
export function createLogger(name: string) {
    return {
        info: (msg: any, details?: string) => {
            console.log(`[${name}] INFO:`, msg, details || "");
        },
        error: (msg: any, details?: string) => {
            console.error(`[${name}] ERROR:`, msg, details || "");
        },
        warn: (msg: any, details?: string) => {
            console.warn(`[${name}] WARN:`, msg, details || "");
        }
    };
}
