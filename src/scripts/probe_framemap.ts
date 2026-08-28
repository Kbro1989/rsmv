import * as fs from "fs";

const DUMPS = "D:\\sovereign\\cache_pedagogy\\json_dumps";

// Specific IDs the user will care about most
const TARGETS = {
    items: {
        "Mouse toy": [7771],
        "Sextant": [2573],
        "Crystal teleport seed": [6102],
        "Varrock teleport": [8006],
        "Lumbridge teleport": [8007],
    },
    npcs: {
        "Platypus": [7015, 7016, 7017, 7018],
        "Mine cart": [1527, 1544, 1545],
        "Portal of Death": [4380],
        "Portal (Pest Control)": [6142, 6143, 6144, 6145],
        "Lord Crwys": [19532, 19537],
        "Mayor of Prifddinas": [19571],
        "Spirit tree": [3636, 3637],
        "Abyssal demon": [1615, 2263, 2264, 2265],
        "Barrows chest": [21990],
    },
    objects: {
        "Abyss": [6939],
        "Abyssal rift": [7162],
        "Fairy ring": [12085, 12119],
        "Gnome glider": [187, 4857],
        "Lodestone (inactive)": [3535, 3536],
        "Lodestone (active)": [3537, 3546],
        "Mine cart (obj)": [637, 2675],
        "Minecart": [22331],
        "Platypus hole": [29095],
        "Portal (Abyssal)": [1306, 1307],
        "Portal (Magic)": [2154, 2155],
        "Prifddinas": [69714],
        "Crwys voicestone": [92374, 92375],
        "Seal of Crwys": [91807],
        "Spirit tree (obj)": [1293, 1294],
        "Canoe station": [12135, 12136],
        "Barrows Meiyerditch": [69777],
    }
};

function loadAndExtract(filepath: string, ids: number[]): any[] {
    let raw = fs.readFileSync(filepath, "utf-8");
    let data = JSON.parse(raw);
    let results: any[] = [];
    
    if (Array.isArray(data)) {
        for (let id of ids) {
            if (data[id]) results.push({ _id: id, ...data[id] });
        }
    } else {
        for (let id of ids) {
            if (data[id]) results.push({ _id: id, ...data[id] });
            else if (data[String(id)]) results.push({ _id: id, ...data[String(id)] });
        }
    }
    return results;
}

async function run() {
    for (let [category, targets] of Object.entries(TARGETS)) {
        let filepath = `${DUMPS}/${category}.json`;
        
        console.log(`\n${"█".repeat(60)}`);
        console.log(`  ${category.toUpperCase()} — Full Entity Data`);
        console.log(`${"█".repeat(60)}`);
        
        for (let [label, ids] of Object.entries(targets)) {
            let entries = loadAndExtract(filepath, ids);
            console.log(`\n  ┌─── ${label} ───`);
            for (let entry of entries) {
                console.log(`  │ ${JSON.stringify(entry, null, 2).split("\n").join("\n  │ ")}`);
            }
            if (entries.length === 0) {
                console.log(`  │ (not found at IDs: ${ids.join(", ")})`);
            }
            console.log(`  └───`);
        }
    }
}

run().catch(console.error);