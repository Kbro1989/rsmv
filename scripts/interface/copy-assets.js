import fs from 'fs';
import path from 'path';

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Copying rsmv assets to dist...');
copyDir('src/opcodes', 'dist/src/opcodes');
copyDir('src/assets', 'dist/src/assets');
// Also copy any json files in src root if they are used
if (fs.existsSync('scripts/config.json')) fs.copyFileSync('scripts/config.json', 'dist/scripts/config.json');

console.log('Assets successfully deployed to dist substrate.');
