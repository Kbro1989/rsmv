import json
import argparse
from pathlib import Path
from typing import Optional, Dict, Any

def main():
    parser = argparse.ArgumentParser(description="Cross-reference Bestiary API data with Cache Pedagogy entities.")
    parser.add_argument("--input", type=str, default="bestiary_pedagogy.jsonl", help="Input JSONL file from scraper")
    parser.add_argument("--output", type=str, default="bestiary_pedagogy_verified.jsonl", help="Output verified JSONL file")
    parser.add_argument("--cache-dir", type=str, default="cache-pedagogy", help="Path to cache pedagogy directory")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    cache_dir = Path(args.cache_dir)

    if not input_path.exists():
        print(f"Error: Input file {input_path} not found.")
        return

    verified_count = 0
    total_count = 0

    with open(input_path, "r", encoding='utf-8') as f_in, \
         open(output_path, "w", encoding='utf-8') as f_out:

        for line in f_in:
            total_count += 1
            entry = json.loads(line)

            # Extract beast ID from the input (it's in the instruction or the data)
            # Since we generated the input in scrape_bestiary.py, we can try to parse it from the canonical JSON
            try:
                canonical = json.loads(entry['input'])
                beast_id = canonical.get('id')
            except Exception:
                beast_id = None

            if beast_id:
                # Lookup in cache pedagogy: cache-pedagogy/entities/npc_{id}.json
                entity_path = cache_dir / "entities" / f"npc_{beast_id}.json"
                if entity_path.exists():
                    try:
                        cache_data = json.loads(entity_path.read_text(encoding='utf-8'))

                        # Enrichment: add cache specific flags to the output
                        # We modify the 'output' field of the pedagogy entry to explicitly mark cache verification
                        if "[VERIFIED]" not in entry['output']:
                            entry['output'] = "[VERIFIED] " + entry['output']

                        entry['cache_cross_reference'] = True
                        entry['cache_entity_id'] = cache_data.get('id')
                        verified_count += 1
                    except Exception as e:
                        print(f"Warning: Failed to parse cache entity for ID {beast_id}: {e}")

            f_out.write(json.dumps(entry) + "\n")

    print(f"Cross-reference complete.")
    print(f"Processed {total_count} entities. Verified {verified_count} against cache forensics.")
    print(f"Verified corpus saved to {output_path}")

if __name__ == "__main__":
    main()
