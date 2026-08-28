import type * as sqlite3 from "sqlite3";
export declare class FileSourceFsCache {
    ready: Promise<void>;
    isready: boolean;
    database: sqlite3.Database;
    getstatement: sqlite3.Statement;
    setstatement: sqlite3.Statement;
    static tryCreate(): FileSourceFsCache | null;
    constructor(filename: string);
    addFile(major: number, minor: number, crc: number, file: Buffer): Promise<void>;
    getFile(major: number, minor: number, crc: number): Promise<Buffer | null>;
}
