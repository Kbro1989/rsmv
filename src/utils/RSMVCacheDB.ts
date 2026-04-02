import Database from 'better-sqlite3';
import { join } from 'path';
import { getSovereignRoot } from './SovereignPathResolver';
import { createLogger } from './logger';

const logger = createLogger('RSMVCacheDB');

export interface GroundedEntity {
    entity_type: 'npc' | 'object';
    entity_id: number;
    x: number;
    y: number;        // renamed from z in some parsers — keeping consistent with RS coords
    z: number;
    plane: number;
    zone_id: number;
    varbit_flags?: Record<string, any>;   // any active varbits controlling this spawn
    is_morphic: boolean;                  // has "Actions" or varbit-controlled morph
    has_actions: boolean;
    material_flags?: { hasNormal: boolean; hasCompound: boolean }; // from taxonomic_synthesis
    learned_at?: string;
}

export class RSMVCacheDB {
    private db: Database.Database;
    private readonly dbPath: string;

    constructor() {
        this.dbPath = join(getSovereignRoot(), 'memory', 'rsmv_cache.db');
        this.db = new Database(this.dbPath);
        this.initSchema();
        logger.info({ path: this.dbPath }, 'RSMV Cache DB initialized');
    }

    private initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS grounded_entities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                z INTEGER NOT NULL,
                plane INTEGER NOT NULL,
                zone_id INTEGER NOT NULL,
                varbit_flags JSON,
                is_morphic BOOLEAN DEFAULT FALSE,
                has_actions BOOLEAN DEFAULT FALSE,
                material_flags JSON,
                learned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_type, entity_id, x, y, z, plane)
            );

            CREATE INDEX IF NOT EXISTS idx_grounded_zone ON grounded_entities(zone_id);
            CREATE INDEX IF NOT EXISTS idx_grounded_entity ON grounded_entities(entity_type, entity_id);
        `);

        logger.info('Grounded entities schema ready — coordinate-exact spatial nervous system online.');
    }

    public insertGrounded(entity: GroundedEntity): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO grounded_entities 
            (entity_type, entity_id, x, y, z, plane, zone_id, varbit_flags, is_morphic, has_actions, material_flags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            entity.entity_type,
            entity.entity_id,
            entity.x,
            entity.y,
            entity.z,
            entity.plane,
            entity.zone_id,
            JSON.stringify(entity.varbit_flags || {}),
            entity.is_morphic ? 1 : 0,
            entity.has_actions ? 1 : 0,
            JSON.stringify(entity.material_flags || {})
        );
    }

    public getEntitiesInZone(zoneId: number): GroundedEntity[] {
        const stmt = this.db.prepare('SELECT * FROM grounded_entities WHERE zone_id = ?');
        return stmt.all(zoneId) as GroundedEntity[];
    }

    public getAllGroundedCount(): number {
        const result = this.db.prepare('SELECT COUNT(*) as c FROM grounded_entities').get() as { c: number };
        return result.c;
    }

    public close(): void {
        this.db.close();
    }
}
