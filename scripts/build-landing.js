const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const apps = [
    { name: 'esl-planner', dir: 'planner' },
    { name: 'essay-lab', dir: 'essay-lab' },
    { name: 'nature-compass', dir: 'nature-compass' },
    { name: 'academy-ops', dir: 'academy-ops' },
];

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Clean dist
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });

// Copy landing page files
for (const file of ['index.html', 'style.css', 'logo.png']) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(DIST, file));
        console.log(`Copied ${file}`);
    }
}

// Copy each app's build output
for (const app of apps) {
    const appDist = path.join(ROOT, 'apps', app.name, 'dist');
    const target = path.join(DIST, app.dir);
    if (fs.existsSync(appDist)) {
        copyDir(appDist, target);
        console.log(`Copied ${app.name} → dist/${app.dir}/`);
    } else {
        console.error(`WARNING: ${appDist} does not exist. Did the build fail?`);
    }
}

console.log('\nBuild assembly complete!');
