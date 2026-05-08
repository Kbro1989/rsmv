import type * as sqlite3 from "sqlite3";
export declare function sqliteOpenDatabase(filepath: string, opts: {
    write?: boolean;
    create?: boolean;
}): Promise<sqlite3.Database>;
export declare function sqlitePrepare(db: sqlite3.Database, query: string): Promise<sqlite3.Statement>;
export declare function sqliteExec(db: sqlite3.Database, query: string): Promise<void>;
export declare function sqliteRunStatement(statement: sqlite3.Statement, args?: any[]): Promise<any[]>;
