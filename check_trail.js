const fs = require('fs');

const target = Buffer.from([0x02, 0x38, 0x10]); // 145424 tribyte

const cacheFiles = [
  { major: 3, file: 'C:/ProgramData/Jagex/RuneScape/js5-3.jcache', name: 'NPCs' },
  { major: 8, file: 'C:/ProgramData/Jagex/RuneScape/js5-8.jcache', name: 'Models' },
  { major: 21, file: 'C:/ProgramData/Jagex/RuneScape/js5-21.jcache', name: 'Spotanims' },
  { major: 2, file: 'C:/ProgramData/Jagex/RuneScape/js5-2.jcache', name: 'Locs' },
];

for (const cf of cacheFiles) {
  try {
    const stat = fs.statSync(cf.file);
    if (stat.size > 2 * 1024 * 1024 * 1024) {
      console.log(`${cf.name} (${cf.major}): FILE TOO LARGE (${stat.size} bytes)`);
      continue;
    }
    
    const buf = fs.readFileSync(cf.file);
    let count = 0;
    let pos = 0;
    while (true) {
      const idx = buf.indexOf(target, pos);
      if (idx === -1) break;
      count++;
      pos = idx + 1;
    }
    
    console.log(`${cf.name} (major ${cf.major}): ${count} occurrences of model 145424`);
  } catch (e) {
    console.log(`${cf.name} (${cf.major}): ERROR - ${e.message}`);
  }
}
