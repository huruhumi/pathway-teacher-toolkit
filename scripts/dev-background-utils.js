const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_DIR = path.join(ROOT, '.dev-runtime');
const STATE_FILE = path.join(RUNTIME_DIR, 'dev-all.json');
const OUT_LOG = path.join(RUNTIME_DIR, 'dev-all.out.log');
const ERR_LOG = path.join(RUNTIME_DIR, 'dev-all.err.log');
const DEV_SCRIPT = path.join(ROOT, 'scripts', 'dev-staggered.js');

function ensureRuntimeDir() {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function readState() {
    if (!fs.existsSync(STATE_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return null;
    }
}

function writeState(state) {
    ensureRuntimeDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function removeState() {
    if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
    }
}

function isPidRunning(pid) {
    if (!pid || !Number.isInteger(pid)) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error && error.code === 'EPERM';
    }
}

function getBackgroundLaunch() {
    return {
        command: process.execPath,
        args: [DEV_SCRIPT],
    };
}

module.exports = {
    ROOT,
    RUNTIME_DIR,
    STATE_FILE,
    OUT_LOG,
    ERR_LOG,
    DEV_SCRIPT,
    ensureRuntimeDir,
    readState,
    writeState,
    removeState,
    isPidRunning,
    getBackgroundLaunch,
};
