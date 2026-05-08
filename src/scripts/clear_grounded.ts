import Database from "better-sqlite3";
import * as path from "path";

const DB_PATH = path.join(process.cwd(), "rsmvCacheDB.sqlite");

function clearGrounded() {
    console.log("🧹 Clearing grounded_entities table...");
    const db = new Database(DB_PATH);
    try {
        db.prepare("DELETE FROM grounded_entities").run();
        console.log("✅ Table cleared.");
    } catch (e) {
        console.error("❌ Clear failed:", e);
    } finally {
        db.close();
    }
}

clearGrounded();
