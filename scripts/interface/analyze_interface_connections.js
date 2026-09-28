import fs from 'fs';
import path from 'path';

const interfaceDir = 'D:/sovereign/cache_pedagogy/atlas/interfaces';
const files = fs.readdirSync(interfaceDir).filter(f => f.endsWith('_decomposed.json'));

const hierarchy = new Map();

files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(interfaceDir, file), 'utf8'));
    const id = data.interfaceId;
    
    // Scan components for references to other interfaces
    const connections = new Set();
    data.components?.forEach(comp => {
        // Logic: Often interfaces reference child interfaces via specific fields
        // or embedded interface definitions. 
        if (comp.type === 'INTERFACE') { // Hypothetical indicator
            connections.add(comp.childInterfaceId);
        }
    });

    hierarchy.set(id, {
        file,
        connections: Array.from(connections)
    });
});

console.log(JSON.stringify(Array.from(hierarchy.entries()), null, 2));
