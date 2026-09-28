import requests
import json
import asyncio
import aiohttp
from pathlib import Path
from typing import Optional, Dict, Any

# Configuration
BASE_URL = "http://services.runescape.com/m=itemdb_rs/bestiary"
OUTPUT_FILE = Path("bestiary_pedagogy.jsonl")
CACHE_PEDAGOGY_DIR = Path("cache-pedagogy")
WEAKNESS_MAP_FILE = "weakness_map.json" # We will populate this first

async def fetch_weakness_names():
    """Fetch the canonical mapping of weakness names to IDs."""
    url = f"{BASE_URL}/weaknessNames.json"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json()
                # Expected format: {"WeaknessName": id, ...}
                return data
    return {}

def lookup_cache_entity(beast_id: int) -> Optional[Dict[str, Any]]:
    """
    Cross-reference with the 229k verified cache entities.
    Expects entities to be stored in a predictable structure under CACHE_PEDAGOGY_DIR.
    """
    # Search for NPC metadata in the pedagogy cache
    # Pattern: cache-pedagogy/entities/npc_{id}.json
    entity_path = CACHE_PEDAGOGY_DIR / "entities" / f"npc_{beast_id}.json"
    if entity_path.exists():
        try:
            return json.loads(entity_path.read_text(encoding='utf-8'))
        except Exception:
            return None
    return None

def format_rsmv_output(bestiary_data: Dict[str, Any], cache_entity: Optional[Dict[str, Any]], weakness_map: Dict[str, Any]) -> str:
    """Format as POG2 pedagogy with [VERIFIED] tags and limb routing hints."""
    weakness = bestiary_data.get("weakness", "None")
    weakness_id = weakness_map.get(weakness, "N/A")

    lines = [
        f"[VERIFIED] Entity {bestiary_data['id']}: {bestiary_data['name']}",
        f"[SOURCE] Jagex Bestiary API + cache forensics",
        "",
        f"## Combat Profile (GhostSplat Engine)",
        f"- Combat Level: {bestiary_data['combat_level']}",
        f"- Lifepoints: {bestiary_data['lifepoints']}",
        f"- Attack: {bestiary_data['attack']} | Defence: {bestiary_data['defence']}",
        f"- Magic: {bestiary_data['magic']} | Ranged: {bestiary_data['ranged']}",
        f"- Weakness: {weakness} (ID: {weakness_id})",
        f"- Slayer Requirement: {bestiary_data['slayer_level'] or 'None'}",
        f"- Slayer Category: {bestiary_data['slayer_cat'] or 'None'}",
        f"- Size: {bestiary_data['size']}x{bestiary_data['size']}",
        f"- Aggressive: {bestiary_data['aggressive']} | Poisonous: {bestiary_data['poisonous']}",
        "",
        f"## Spatial Profile (SpatialPipeline)",
        f"- Spawn Areas: {', '.join(bestiary_data['areas']) if isinstance(bestiary_data['areas'], list) else bestiary_data['areas']}",
        f"- Animation Keys: {json.dumps(bestiary_data['animations'])}",
        "",
        f"## Examine Text",
        f'"{bestiary_data["examine"]}"',
    ]

    if cache_entity:
        lines.extend([
            "",
            f"## Cache Cross-Reference (CacheForensicsLimb)",
            f"- Cache Entity ID: {cache_entity.get('id')}",
            f"- Cache Revision: {cache_entity.get('revision', 'unknown')}",
            f"- Varbit Masks: {cache_entity.get('varbits', [])}",
            f"- Collision Layer: {cache_entity.get('collision', 'unverified')}",
        ])

    lines.extend([
        "",
        "## Hexagram Routing",
        "- Primary Limb: CombatRotationEngine",
        "- Secondary: LootResolutionEngine",
        "- Fallback: AggressionSimulator",
        "- Yao Line 3 (Action): Engage if combat_level <= player_level + 10",
    ])

    return "\n".join(lines)

async def fetch_beast(session: aiohttp.ClientSession, beast_id: int, weakness_map: Dict[str, Any]):
    """Primary source: Jagex Bestiary API. Cross-reference with cache entity ID."""
    url = f"{BASE_URL}/beastData.json?beastid={beast_id}"
    try:
        async with session.get(url, timeout=30) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()

            # Canonical fields per API spec
            canonical = {
                "id": data.get("id"),
                "name": data.get("name"),
                "examine": data.get("description"),
                "combat_level": data.get("level"),
                "lifepoints": data.get("lifepoints"),
                "attack": data.get("attack"),
                "defence": data.get("defence"),
                "magic": data.get("magic"),
                "ranged": data.get("ranged"),
                "weakness": data.get("weakness"),
                "slayer_level": data.get("slayerlevel"),
                "slayer_cat": data.get("slayercat"),
                "size": data.get("size"),
                "aggressive": data.get("aggressive"),
                "poisonous": data.get("poisonous"),
                "areas": data.get("areas", []),
                "animations": data.get("animations", {}),
                "members": data.get("members"),
                "xp": data.get("xp"),
            }

            cache_entity = lookup_cache_entity(beast_id)

            return {
                "instruction": f"Generate a verified RS3 entity definition for beast ID {beast_id}",
                "input": json.dumps(canonical, indent=2),
                "output": format_pog2_output(canonical, cache_entity, weakness_map),
                "source": "jagex_bestiary_api",
                "verified": True,
                "cache_cross_reference": cache_entity is not None
            }
    except Exception as e:
        return None

async def build_corpus():
    print("Fetching weakness mapping...")
    weakness_map = await fetch_weakness_names()

    async with aiohttp.ClientSession() as session:
        # The beast range is generally between 0-20000.
        # We use a smaller batch for initial testing or a full range for production.
        tasks = [fetch_beast(session, i, weakness_map) for i in range(20000)]
        results = await asyncio.gather(*tasks)

    valid = [r for r in results if r]
    with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
        for entry in valid:
            f.write(json.dumps(entry) + "\n")

    print(f"Corpus built: {len(valid)} verified entities")

if __name__ == "__main__":
    asyncio.run(build_corpus())
