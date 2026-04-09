import * as fs from "fs";
import * as path from "path";

function testCollisionGrid() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("Usage: npx tsx src/scripts/test_ascii_collision.ts <worldX> <worldY> [plane]");
        console.error("Example: npx tsx src/scripts/test_ascii_collision.ts 1696 10448 1");
        return;
    }

    const centerX = parseInt(args[0], 10);
    const centerY = parseInt(args[1], 10);
    const plane = args.length >= 3 ? parseInt(args[2], 10) : 1;

    // Resolve Region ID from absolute world coordinates
    const rx = Math.floor(centerX / 64);
    const ry = Math.floor(centerY / 64);
    const regionId = (rx << 8) | ry;

    const dataPath = path.resolve(__dirname, `../../../atlas/spatial/directional_${regionId}.json`);
    if (!fs.existsSync(dataPath)) {
        console.error(`No directional logic file found for Region ${regionId} at: ${dataPath}`);
        console.error(`Make sure to extract it first using: npx tsx src/tools/spatial/extract_directional_collision.ts ${centerX} ${centerY}`);
        return;
    }

    const matrix = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    const radiusX = 25; // View distance
    const radiusY = 15;

    console.log(`\n=== Directional Heatmap ===`);
    console.log(`Center: [${centerX}, ${centerY}, Plane ${plane}]\n`);
    
    let output = "";

    // RS coordinates have North = +Y, South = -Y
    for (let y = centerY + radiusY; y >= centerY - radiusY; y--) {
        let row = "";
        for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
            const key = `${plane}_${x}_${y}`;
            const tile = matrix[key];
            
            if (!tile) {
                row += ". "; // Walkable Default
            } else if (tile.north === false && tile.south === false && tile.east === false && tile.west === false) {
                row += "X "; // Fully blocked (solid object or terrain)
            } else if (tile.north === false || tile.south === false || tile.east === false || tile.west === false) {
                // Determine which walls specifically
                if (!tile.north && !tile.east) row += "╝ ";
                else if (!tile.north && !tile.west) row += "╚ ";
                else if (!tile.south && !tile.east) row += "╗ ";
                else if (!tile.south && !tile.west) row += "╔ ";
                else if (!tile.north) row += "^ ";
                else if (!tile.south) row += "v ";
                else if (!tile.east) row += "> ";
                else if (!tile.west) row += "< ";
                else row += "W ";
            } else {
                row += ". "; // Explicitly marked walkable (all true)
            }
        }
        output += `${y.toString().padStart(5, " ")} | ${row}\n`;
    }

    console.log(output);
    console.log(`Legend: . = Walkable | X = Solid Block | Directional Arrows/Corners = Walls\n`);
}

testCollisionGrid();
