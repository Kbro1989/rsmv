/**
 * Pedagogy Knowledge Base Type Definitions
 * Auto-generated TypeScript interfaces for all data structures
 * 
 * Generated: March 24, 2026
 * Source: varbits_registry.json, mapzones_registry.json, file inventory
 */

// ============================================================================
// VARBITS SYSTEM
// ============================================================================

/**
 * A varbit is a single piece of boolean or numeric player state
 * Stored efficiently as bit ranges within larger variables
 */
export interface Varbit {
  /** Unique identifier for this varbit (0-60463) */
  id: number;
  
  /** Variable ID that stores this varbit */
  varid: number;
  
  /** Bit range [start, end] within the variable */
  bits: [number, number];
}

/**
 * The complete varbits registry mapping varbit IDs to storage locations
 * Key: varbit ID (as string)
 * Value: Varbit definition
 */
export type VarbitsRegistry = Record<string, Varbit>;

// ============================================================================
// MAPZONES SYSTEM
// ============================================================================

/**
 * A rectangular boundary defined by coordinate corners
 */
export interface CoordinateBounds {
  /** X coordinate of top-left corner */
  xstart: number;
  
  /** Z coordinate of top-left corner */
  zstart: number;
  
  /** X coordinate of bottom-right corner */
  xend: number;
  
  /** Z coordinate of bottom-right corner */
  zend: number;
}

/**
 * Maps source coordinates to destination coordinates
 * Used for teleportation, instancing, etc.
 */
export interface CoordinateMapping {
  /** Plane/floor level (0=surface, 1=underground, etc.) */
  plane: number;
  
  /** Original/canonical location */
  src: CoordinateBounds;
  
  /** Mapped/destination location */
  dst: CoordinateBounds;
}

/**
 * Represents a single zone in the game world
 */
export interface Mapzone {
  /** Internal identifier for code use */
  internal_name: string;
  
  /** Display name for UI */
  name: string;
  
  /** Packed center coordinate (encode: x << 16 | z) */
  center: number;
  
  /** Unknown field (preserved from original data) */
  unknown_1: number;
  
  /** Whether zone should be shown on map */
  show: boolean;
  
  /** Default zoom level for map */
  default_zoom: number;
  
  /** Unknown field (preserved from original data) */
  unknown_2: number;
  
  /** Rectangular bounds for this zone (multiple allowed) */
  bounds: CoordinateMapping[];
  
  /** JSON schema reference (if any) */
  $schema?: string;
  
  /** Decoded center coordinate [x, z, plane] */
  unpackedCenter?: { x: number, z: number, plane: number };
}

/**
 * The complete mapzones registry
 * Key: zone ID (as string)
 * Value: Mapzone definition
 */
export type MapzonesRegistry = Record<string, Mapzone>;

// ============================================================================
// ENTITY SYSTEMS
// ============================================================================

/**
 * An NPC (Non-Player Character) instance in the world
 */
export interface NPCInstance {
  id: number;
  x: number;
  z: number;
  plane: number;
}

/**
 * A game object instance in the world
 */
export interface ObjectInstance {
  id: number;
  x: number;
  z: number;
  plane: number;
}

// ============================================================================
// SPATIAL ATLAS
// ============================================================================

/**
 * The final grounded Atlas entry for a single zone
 */
export interface SpatialAtlasEntry {
    zone: Mapzone;
    npcs: NPCInstance[];     // List of NPC instances found in this zone
    objects: ObjectInstance[];  // List of Object instances found in this zone
    varbits: number[];       // List of Varbit IDs associated with these entities
    varps: number[];         // List of Varp IDs associated with these entities
}

/**
 * Complete Spatial Pedagogy Registry
 * Key: Zone Center ID (packed)
 */
export type SpatialPedagogyRegistry = Record<number, SpatialAtlasEntry>;
