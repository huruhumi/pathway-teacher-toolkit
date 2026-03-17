const fs = require('fs');
const path = require('path');
const { runMain } = require('./app-task-runner');
const { createScriptLogger } = require('./script-logger');
const { toBuildAssemblyApps } = require('./app-targets');
const {
    copyRootFiles,
    copyRegistryFile,
    copyAppDists,
} = require('./landing-assembly');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const APP_REGISTRY_SOURCE = path.join(ROOT, 'packages', 'config', 'app-registry.json');
const log = createScriptLogger('landing-build');

const apps = toBuildAssemblyApps();
const ROOT_FILES = Object.freeze([
    'index.html',
    'style.css',
    'logo.png',
    'landing-copy.js',
    'landing-runtime.js',
    'landing-dom.js',
    'i18n.js',
    'auth.js',
]);

async function main() {
    if (fs.existsSync(DIST)) {
        fs.rmSync(DIST, { recursive: true });
    }
    fs.mkdirSync(DIST, { recursive: true });

    copyRootFiles({ rootDir: ROOT, distDir: DIST, files: ROOT_FILES, log });
    copyRegistryFile({ sourcePath: APP_REGISTRY_SOURCE, distDir: DIST, log });
    copyAppDists({ rootDir: ROOT, distDir: DIST, apps, log });

    console.log('');
    log.info('Build assembly complete.');
}

runMain('landing-build', main);
