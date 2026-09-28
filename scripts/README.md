# scripts

One-off extraction, forensics, and repair scripts for POG2 substrate work.

## Files

- `direct_pog2_extract.ts`
  - Direct cache extraction entrypoint
- `extract_item_raw.ts`, `extract_npc_raw.ts`
  - Item/NPC raw extraction
- `cache_item_forensics.ts`, `cache_npc_forensics.ts`, `cache_quest_forensics.ts`
  - Forensic extraction with typed outputs
- `cache_name_search.ts`
  - Name-based cache search
- `cache_enum_scanner.ts`
  - Enum/scanner forensics
- `enum_forensics.ts`
  - Enum analysis
- `decode_kinematics.ts`
  - Kinematic decoder probe
- `grounding_decoder.ts`
  - Grounding/teleport decoder
- `spatial_bridge_heatmap.ts`
  - Spatial bridge heatmap visualization
- `logic_joiner.ts`
  - Logic entity join/reconciliation
- `synthesize_barrows_logic.ts`
  - Barrows logic synthesis from cache data
- `discover_collision_rules.ts`
  - Collision rule discovery
- `extract_directional_collision.ts`
  - Directional collision extraction
- `extract_cache_logic.ts`
  - Cache logic extraction
- `ground_sovereign_substrate.ts`, `ground_ui_blueprint.ts`
  - Grounding/blueprint generators
- `analyze_interface_connections.js`
  - Interface connection analysis
- `cleanup_screenshots.cjs`
  - Screenshot cleanup utility
- `test_immunology_integration.mjs`
  - Immunology integration smoke tests
- `refactored_extract_1430.ts`
  - Refactored extraction for protocol 1430
- Various `fix_*.cjs`/`fix_*.ts`/`fix_*.js`
  - One-off repair scripts for import/core fixes

## Intent

This folder is for substrate operations, not runtime behavior. Scripts here
are run explicitly to extract, repair, or analyze cache/data artifacts.
