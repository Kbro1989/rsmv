const opcodes = {};

const dataGroup = ["struct",
    ["cols","ubyte"],
    ["columndata",["nullarray","ubyte",255,["struct",
        ["id",["ref","$opcode",[0,6]]],
        ["columns",["chunkedarray","ubyte",[
            ["type","varushort"]
        ],[
            ["value",["match",["ref","type"],{
                "0x21":"uint",
                "0x24":"string",
                "other":"int"
            }]]
        ]]]
    ]]]
];

for (let i = 1; i <= 254; i++) {
    const hex = "0x" + i.toString(16).padStart(2, "0");
    if (i === 1 || i === 2 || i === 3) {
        opcodes[hex] = { "name": `group${i}`, "read": dataGroup };
    } else if (i === 4) {
        opcodes[hex] = { "name": "tableId", "read": "varushort" };
    } else {
        opcodes[hex] = { "name": `unk${i}`, "read": "ubyte" }; // Placeholder
    }
}

const fs = require('fs');
fs.writeFileSync("src/opcodes/dbrows.jsonc", JSON.stringify(opcodes, null, 2));
console.log("Updated src/opcodes/dbrows.jsonc");
