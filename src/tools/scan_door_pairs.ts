import * as fs from 'fs';

async function scanDoorPairs() {
    const data = JSON.parse(fs.readFileSync('D:\\sovereign\\cache_pedagogy\\json_dumps\\objects.json', 'utf8'));
    const objects = Object.values(data);
    const doors = objects.filter((o: any) => o.name && (o.name === 'Door' || o.name === 'Gate'));
    
    const pairs: any[] = [];
    
    for (let i = 0; i < doors.length; i++) {
        for (let j = i + 1; j < doors.length; j++) {
            const d1: any = doors[i];
            const d2: any = doors[j];
            
            // Heuristic: Close IDs, same name, swap actions
            if (Math.abs(d1.id - d2.id) < 5 && d1.name === d2.name) {
                pairs.push({
                    closed: d1.id,
                    open: d2.id,
                    name: d1.name
                });
            }
        }
    }
    
    console.log(JSON.stringify(pairs.slice(0, 20), null, 2));
}

scanDoorPairs();
