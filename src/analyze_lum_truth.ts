import * as fs from 'fs';

function analyzeCollisionGrid() {
    console.log("[GODHEAD] Analyzing Lumbridge Collision Truth...");
    const data = JSON.parse(fs.readFileSync("D:\\sovereign\\atlas\\spatial\\pathing_theory\\lumbridge_collision_v1.json", 'utf-8'));
    
    const labels = new Set();
    const planeRanges = {};

    for (const plane in data.planes) {
        planeRanges[plane] = { minX: 99999, maxX: -1, minY: 99999, maxY: -1 };
        for (const tile of data.planes[plane]) {
            labels.add(tile.label);
            planeRanges[plane].minX = Math.min(planeRanges[plane].minX, tile.x);
            planeRanges[plane].maxX = Math.max(planeRanges[plane].maxX, tile.x);
            planeRanges[plane].minY = Math.min(planeRanges[plane].minY, tile.y);
            planeRanges[plane].maxY = Math.max(planeRanges[plane].maxY, tile.y);
        }
    }

    console.log("[LABELS FOUND]", Array.from(labels));
    console.log("[PLANE RANGES]", planeRanges);
}

analyzeCollisionGrid();
