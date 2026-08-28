/**
 * Sovereign Ability Registry Builder
 * 
 * Builds a comprehensive Ability → SpotAnim → Model → Sequence lookup table
 * by cross-referencing materialized cache data. This registry enables remapping
 * any RuneScape ability from cache to backend playback.
 */

const fs = require("fs");
const path = require("path");

const PEDAGOGY = "D:\\sovereign\\memory\\pedagogy";
const spotanims = JSON.parse(fs.readFileSync(path.join(PEDAGOGY, "spotanims.json"), "utf8"));
const sequences = JSON.parse(fs.readFileSync(path.join(PEDAGOGY, "sequences.json"), "utf8"));

// Build sequence lookup
const seqMap = {};
sequences.forEach(s => { seqMap[s.id] = s; });

// ═══════════════════════════════════════════════════════════════
// PHASE 1: Known ability → spotanim mappings (from wiki + cache forensics)
// ═══════════════════════════════════════════════════════════════

const KNOWN_ABILITIES = {
    // ── NECROMANCY ────────────────────────────────────────────
    "Touch of Death":         { style: "necromancy", type: "basic",    spotAnims: [4577] },
    "Finger of Death":        { style: "necromancy", type: "threshold", spotAnims: [4587, 4588] },
    "Death Skulls":           { style: "necromancy", type: "ultimate", spotAnims: [] },
    "Soul Sap":               { style: "necromancy", type: "basic",    spotAnims: [] },
    "Soul Strike":            { style: "necromancy", type: "basic",    spotAnims: [] },
    "Volley of Souls":        { style: "necromancy", type: "threshold", spotAnims: [] },
    "Spectral Scythe":        { style: "necromancy", type: "basic",    spotAnims: [4577, 4578, 4579, 4580, 4581, 4582] },
    "Spectral Scythe (Arc)":  { style: "necromancy", type: "basic",    spotAnims: [4583, 4584, 4585, 4586] },
    "Spectral Scythe (Impact)": { style: "necromancy", type: "basic",  spotAnims: [4587, 4588, 4589, 4590, 4591, 4592, 4593, 4594] },
    "Conjure Skeleton":       { style: "necromancy", type: "conjure",  spotAnims: [] },
    "Conjure Zombie":         { style: "necromancy", type: "conjure",  spotAnims: [] },
    "Conjure Ghost":          { style: "necromancy", type: "conjure",  spotAnims: [] },
    "Death Guard (spec)":     { style: "necromancy", type: "special",  spotAnims: [] },
    
    // ── MELEE ────────────────────────────────────────────────
    "Slice":                  { style: "melee", type: "basic",    spotAnims: [] },
    "Cleave":                 { style: "melee", type: "basic",    spotAnims: [] },
    "Sever":                  { style: "melee", type: "basic",    spotAnims: [] },
    "Havoc":                  { style: "melee", type: "basic",    spotAnims: [] },
    "Smash":                  { style: "melee", type: "basic",    spotAnims: [] },
    "Assault":                { style: "melee", type: "threshold", spotAnims: [] },
    "Destroy":                { style: "melee", type: "threshold", spotAnims: [] },
    "Hurricane":              { style: "melee", type: "threshold", spotAnims: [] },
    "Quake":                  { style: "melee", type: "threshold", spotAnims: [] },
    "Slaughter":              { style: "melee", type: "threshold", spotAnims: [] },
    "Overpower":              { style: "melee", type: "ultimate",  spotAnims: [] },
    "Meteor Strike":          { style: "melee", type: "ultimate",  spotAnims: [] },
    "Berserk":                { style: "melee", type: "ultimate",  spotAnims: [] },
    "Pulverise":              { style: "melee", type: "ultimate",  spotAnims: [] },
    "Dragon Claw (spec)":     { style: "melee", type: "special",  spotAnims: [] },
    "Armadyl Godsword (spec)":{ style: "melee", type: "special",  spotAnims: [] },
    
    // ── RANGED ───────────────────────────────────────────────
    "Piercing Shot":          { style: "ranged", type: "basic",    spotAnims: [] },
    "Dazing Shot":            { style: "ranged", type: "basic",    spotAnims: [] },
    "Needle Strike":          { style: "ranged", type: "basic",    spotAnims: [] },
    "Snap Shot":              { style: "ranged", type: "threshold", spotAnims: [] },
    "Rapid Fire":             { style: "ranged", type: "threshold", spotAnims: [] },
    "Shadow Tendrils":        { style: "ranged", type: "threshold", spotAnims: [] },
    "Bombardment":            { style: "ranged", type: "threshold", spotAnims: [] },
    "Tight Bindings":         { style: "ranged", type: "threshold", spotAnims: [] },
    "Death's Swiftness":      { style: "ranged", type: "ultimate",  spotAnims: [] },
    "Unload":                 { style: "ranged", type: "ultimate",  spotAnims: [] },
    "Dark Bow (spec)":        { style: "ranged", type: "special",  spotAnims: [] },
    "Eldritch Crossbow (spec)": { style: "ranged", type: "special", spotAnims: [] },
    
    // ── MAGIC ────────────────────────────────────────────────
    "Wrack":                  { style: "magic", type: "basic",    spotAnims: [] },
    "Dragon Breath":          { style: "magic", type: "basic",    spotAnims: [] },
    "Sonic Wave":             { style: "magic", type: "basic",    spotAnims: [] },
    "Impact":                 { style: "magic", type: "basic",    spotAnims: [] },
    "Wild Magic":             { style: "magic", type: "threshold", spotAnims: [] },
    "Asphyxiate":             { style: "magic", type: "threshold", spotAnims: [] },
    "Deep Impact":            { style: "magic", type: "threshold", spotAnims: [] },
    "Detonate":               { style: "magic", type: "threshold", spotAnims: [] },
    "Sunshine":               { style: "magic", type: "ultimate",  spotAnims: [] },
    "Omnipower":              { style: "magic", type: "ultimate",  spotAnims: [] },
    "Guthix Staff (spec)":    { style: "magic", type: "special",  spotAnims: [] },
    "Staff of Armadyl (spec)":{ style: "magic", type: "special",  spotAnims: [] },
    
    // ── DEFENSE / CONSTITUTION ───────────────────────────────
    "Resonance":              { style: "defense", type: "threshold", spotAnims: [] },
    "Barricade":              { style: "defense", type: "ultimate",  spotAnims: [] },
    "Devotion":               { style: "defense", type: "threshold", spotAnims: [] },
    "Debilitate":             { style: "defense", type: "threshold", spotAnims: [] },
    "Reflect":                { style: "defense", type: "threshold", spotAnims: [] },
    "Immortality":            { style: "defense", type: "ultimate",  spotAnims: [] },
    "Natural Instinct":       { style: "defense", type: "ultimate",  spotAnims: [] },
    
    // ── MOVEMENT ─────────────────────────────────────────────
    "Surge":                  { style: "movement", type: "basic", spotAnims: [] },
    "Escape":                 { style: "movement", type: "basic", spotAnims: [] },
    "Bladed Dive":            { style: "movement", type: "basic", spotAnims: [] },
    
    // ── SKILLS (non-combat GFX) ──────────────────────────────
    "Mining (swing)":         { style: "skill", type: "action", spotAnims: [] },
    "Woodcutting (chop)":     { style: "skill", type: "action", spotAnims: [] },
    "Fishing (cast)":         { style: "skill", type: "action", spotAnims: [] },
    "Smithing (strike)":      { style: "skill", type: "action", spotAnims: [] },
    "Cooking (fire)":         { style: "skill", type: "action", spotAnims: [] },
    "Prayer (activate)":      { style: "skill", type: "action", spotAnims: [] },
    "Lodestone Teleport":     { style: "skill", type: "teleport", spotAnims: [] },
    "Home Teleport":          { style: "skill", type: "teleport", spotAnims: [] },
};

// ═══════════════════════════════════════════════════════════════
// PHASE 2: Enrich each entry with resolved model + sequence data
// ═══════════════════════════════════════════════════════════════

const registry = {};

for (const [name, def] of Object.entries(KNOWN_ABILITIES)) {
    const resolvedGFX = def.spotAnims.map(id => {
        const sa = spotanims.find(s => s.id === id);
        if (!sa) return { spotAnimId: id, resolved: false };
        const seq = seqMap[sa.sequence] || null;
        return {
            spotAnimId: id,
            modelId: sa.model,
            sequenceId: sa.sequence,
            additiveBlend: !!sa.unk2e,
            frameCount: seq ? seq.frames?.length || 0 : 0,
            frameArchive: seq?.frames?.[0]?.frameidhi || null,
            totalTicks: seq ? (seq.frames || []).reduce((s, f) => s + (f.framelength || 0), 0) : 0,
            resolved: true,
        };
    });
    
    registry[name] = {
        style: def.style,
        type: def.type,
        gfx: resolvedGFX,
        wired: resolvedGFX.length > 0 && resolvedGFX.every(g => g.resolved),
    };
}

// ═══════════════════════════════════════════════════════════════
// PHASE 3: Auto-discover potential ability GFX by sequence clustering
// ═══════════════════════════════════════════════════════════════

// Group spotanims by model to find "ability families"
const modelClusters = {};
spotanims.forEach(sa => {
    const m = sa.model || 0;
    if (m === 0) return; // skip empty models
    if (!modelClusters[m]) modelClusters[m] = [];
    modelClusters[m].push({
        spotAnimId: sa.id,
        sequenceId: sa.sequence,
        additiveBlend: !!sa.unk2e,
    });
});

// Find clusters that look like ability families (2-20 related GFX)
const abilityFamilies = Object.entries(modelClusters)
    .filter(([_, v]) => v.length >= 2 && v.length <= 20)
    .map(([model, entries]) => ({
        model: parseInt(model),
        count: entries.length,
        idRange: [Math.min(...entries.map(e => e.spotAnimId)), Math.max(...entries.map(e => e.spotAnimId))],
        entries: entries,
    }))
    .sort((a, b) => b.count - a.count);

// ═══════════════════════════════════════════════════════════════
// PHASE 4: Output
// ═══════════════════════════════════════════════════════════════

const output = {
    _meta: {
        generated: new Date().toISOString(),
        totalSpotAnims: spotanims.length,
        totalSequences: sequences.length,
        knownAbilities: Object.keys(registry).length,
        wiredAbilities: Object.values(registry).filter(r => r.wired).length,
        discoveredFamilies: abilityFamilies.length,
    },
    abilities: registry,
    discoveredFamilies: abilityFamilies.slice(0, 100), // Top 100 families for review
};

fs.writeFileSync(
    path.join(PEDAGOGY, "sovereign_ability_registry.json"),
    JSON.stringify(output, null, 2)
);

// Summary
const wired = Object.entries(registry).filter(([_, v]) => v.wired);
const unwired = Object.entries(registry).filter(([_, v]) => !v.wired);

console.log("═══════════════════════════════════════════════════");
console.log("  SOVEREIGN ABILITY REGISTRY — BUILD COMPLETE");
console.log("═══════════════════════════════════════════════════");
console.log("");
console.log("WIRED (" + wired.length + "):");
wired.forEach(([name, v]) => {
    const gfx = v.gfx[0];
    console.log("  [OK] " + name + " -> SpotAnim " + gfx.spotAnimId + " Model " + gfx.modelId + " Seq " + gfx.sequenceId + " (" + gfx.totalTicks + " ticks)");
});
console.log("");
console.log("UNWIRED (" + unwired.length + ") — need spotanim ID mapping:");
unwired.forEach(([name, v]) => {
    console.log("  [ ] " + name + " (" + v.style + "/" + v.type + ")");
});
console.log("");
console.log("DISCOVERED ABILITY FAMILIES: " + abilityFamilies.length);
console.log("Top 10 families by GFX count:");
abilityFamilies.slice(0, 10).forEach(f => {
    console.log("  Model " + f.model + ": " + f.count + " GFX, IDs " + f.idRange[0] + "-" + f.idRange[1]);
});
console.log("");
console.log("Registry written to: sovereign_ability_registry.json");
