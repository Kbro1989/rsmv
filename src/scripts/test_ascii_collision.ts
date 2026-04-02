import * as fs from "fs";
import * as path from "path";

function testCollisionGrid() {
    const dataPath = path.resolve(__dirname, "../logic/prifddinas_logic.json");
    if (!fs.existsSync(dataPath)) {
        console.error("No logic file found at: ", dataPath);
        return;
    }

    const logic = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const matrix = logic.collision_matrix;

    const centerX = 1696;
    const centerY = 10448;
    const plane = 1;
    const radiusX = 25; // View distance
    const radiusY = 15;

    console.log(`\n=== Tower of Voices Collision Grid ===`);
    console.log(`Center: [${centerX}, ${centerY}, Plane ${plane}]\n`);
    
    let output = "";

    // Y increases, but for printing top-down, we start from max Y to min Y
    // RS coordinates have North = +Y, South = -Y
    for (let y = centerY + radiusY; y >= centerY - radiusY; y--) {
        let row = "";
        for (let x = centerX - radiusX; x <= centerX + radiusX; x++) {
            const key = `${plane}_${x}_${y}`;
            const mask = matrix[key];
            if (!mask) {
                row += ". "; // Walkable
            } else if ((mask & 0x200000) !== 0 && (mask & 0x100) !== 0) {
                row += "X "; // Both Terrain + Object
            } else if ((mask & 0x200000) !== 0) {
                row += "T "; // Terrain 
            } else if ((mask & 0x100) !== 0) {
                row += "O "; // Object
            } else {
                row += "? "; // Unknown collision
            }
        }
        output += `${y.toString().padStart(5, " ")} | ${row}\n`;
    }

    console.log(output);
    console.log(`Legend: . = Walkable | T = Terrain | O = Object | X = Both\n`);
}

testCollisionGrid();
