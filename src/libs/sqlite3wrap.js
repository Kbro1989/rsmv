"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqliteOpenDatabase = sqliteOpenDatabase;
exports.sqlitePrepare = sqlitePrepare;
exports.sqliteExec = sqliteExec;
exports.sqliteRunStatement = sqliteRunStatement;
function sqliteOpenDatabase(filepath, opts) {
    //only actually load the dependency when used
    let sqlite = __non_webpack_require__("sqlite3");
    let flags = (opts.write ? sqlite.OPEN_READWRITE : sqlite.OPEN_READONLY) | (opts.create ? sqlite.OPEN_CREATE : 0);
    return new Promise((done, err) => {
        let db = new sqlite.Database(filepath, flags, e => e ? err(e) : done(db));
    });
}
function sqlitePrepare(db, query) {
    return new Promise((done, err) => {
        let stmt = db.prepare(query, e => e ? err(e) : done(stmt));
    });
}
function sqliteExec(db, query) {
    return new Promise((done, err) => {
        db.exec(query, e => e ? err(e) : done());
    });
}
function sqliteRunStatement(statement, args) {
    return new Promise((done, err) => {
        statement.all(args, (e, rows) => e ? err(e) : done(rows));
    });
}
