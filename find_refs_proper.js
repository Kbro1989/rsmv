const fs = require('fs');

const cacheFile = 'C:/ProgramData/Jagex/RuneScape/js5-14.jcache';
const buf = fs.readFileSync(cacheFile);

// Model 145424 = 0x23810 as 3-byte big-endian
const target = Buffer.from([0x02, 0x38, 0x10]);

// Find all positions
const positions = [];
let pos = 0;
while (true) {
  const idx = buf.indexOf(target, pos);
  if (idx === -1) break;
  positions.push(idx);
  pos = idx + 1;
}

console.log(`Found ${positions.length} occurrences of model 145424 (0x02 0x38 0x10)`);

// Now scan for item names near these positions
// Item names are stored as string opcodes (0x02) followed by the name
// Look backwards from each position for a pattern that suggests an item record

const items = new Set();

for (const p of positions) {
  // Look backwards up to 500 bytes for a potential item ID or name
  const start = Math.max(0, p - 300);
  const segment = buf.slice(start, p + 50);
  
  // Search for "Lava" or "Trail" in the vicinity
  const text = segment.toString('latin1');
  const lavaIdx = text.lastIndexOf('Lava');
  if (lavaIdx !== -1) {
    // Found "Lava" near this model reference
    const context = text.substring(Math.max(0, lavaIdx - 50), Math.min(text.length, lavaIdx + 60));
    items.add(`Position ${p}: ...${context.replace(/[\x00-\x1f]/g, '.')}...`);
  }
  
  const trailIdx = text.lastIndexOf('Trail');
  if (trailIdx !== -1) {
    const context = text.substring(Math.max(0, trailIdx - 50), Math.min(text.length, trailIdx + 60));
    items.add(`Position ${p}: ...${context.replace(/[\x00-\x1f]/g, '.')}...`);
  }
}

console.log(`\nFound ${items.size} items with "Lava" or "Trail" near model 145424:`);
for (const item of [...items].slice(0, 20)) {
  console.log(`  ${item}`);
}
