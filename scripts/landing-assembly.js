const fs = require('fs');
const path = require('path');

function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
            continue;
        }

        fs.copyFileSync(srcPath, destPath);
    }
}

function copyRootFiles({ rootDir, distDir, files, log } = {}) {
    for (const file of files) {
        const src = path.join(rootDir, file);
        if (!fs.existsSync(src)) continue;

        fs.copyFileSync(src, path.join(distDir, file));
        log?.info(`Copied ${file}`);
    }
}

function copyRegistryFile({ sourcePath, distDir, targetName = 'app-registry.json', log } = {}) {
    if (!fs.existsSync(sourcePath)) return;
    fs.copyFileSync(sourcePath, path.join(distDir, targetName));
    log?.info(`Copied ${targetName}`);
}

function copyAppDists({ rootDir, distDir, apps, log } = {}) {
    for (const app of apps) {
        const appDist = path.join(rootDir, 'apps', app.sourceDir, 'dist');
        const target = path.join(distDir, app.targetDir);

        if (!fs.existsSync(appDist)) {
            log?.warn(`${appDist} does not exist. Did the build fail?`);
            continue;
        }

        copyDirRecursive(appDist, target);
        log?.info(`Copied ${app.sourceDir} -> dist/${app.targetDir}/`);
    }
}

module.exports = {
    copyDirRecursive,
    copyRootFiles,
    copyRegistryFile,
    copyAppDists,
};
