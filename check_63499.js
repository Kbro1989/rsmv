const fs = require('fs');

const cacheFile = 'C:/ProgramData/Jagex/RuneScape/js5-14.jcache';
const buf = fs.readFileSync(cacheFile);

// Item 63499 — let's find it by scanning the item index
// First, let's read the item index to see what minor IDs exist
// The index is stored in js5-14.jcache at major=14, minor=0

// Actually, let's scan the item record that has "makeover" or "mage" in its name
// Item names are stored as opcode 0x02 (string)

// Let's look at items 63498-63510 which are near the pedestal item
// Item 63498 has "Huge marble pedestal" - these are likely POH items

// Let's find which items reference model 145424 in their baseModelList
// 145424 = 0x02 0x38 0x10

const target = Buffer.from([0x02, 0x38, 0x10]);

const positions = [];
let pos = 0;
while (true) {
  const idx = buf.indexOf(target, pos);
  if (idx === -1) break;
  positions.push(idx);
  pos = idx + 1;
}

console.log(`Found ${positions.length} occurrences of model 145424`);

// For each, check if it's a baseModelList reference (0x09 opcode)
for (const p of positions) {
  // Look backwards for 0x09 (baseModelList opcode)
  let isBaseModelList = false;
  for (let i = p - 5; i >= Math.max(0, p - 20); i--) {
    if (buf[i] === 0x09) {
      isBaseModelList = true;
      break;
    }
  }
  
  // Look backwards for item name (string opcode 0x02 followed by printable chars)
  let name = '';
  for (let i = p - 100; i < p; i++) {
    if (buf[i] === 0x02 && buf[i+1] > 0x1f && buf[i+1] < 0x80) {
      // Found a string opcode, read the name
      let end = i + 1;
      while (end < buf.length && buf[end] > 0x1f && buf[end] < 0x80) end++;
      if (end - i > 3 && end - i < 50) {
        name = buf.slice(i + 1, end).toString('latin1');
        break;
      }
    }
  }
  
  console.log(`  @ ${p}: isBaseModelList=${isBaseModelList}, nearby name="${name}"`);
}
