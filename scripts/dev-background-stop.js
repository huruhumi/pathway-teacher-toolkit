const { spawnSync } = require('child_process');
const { readState, removeState, isPidRunning } = require('./dev-background-utils');

function stopWindowsProcessTree(pid) {
    return spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'pipe',
        encoding: 'utf8',
    });
}

function main() {
    const state = readState();
    if (!state) {
        console.log('Dev stack is not running.');
        return;
    }

    if (!isPidRunning(state.pid)) {
        removeState();
        console.log('Found a stale dev PID file and cleaned it up.');
        return;
    }

    if (process.platform === 'win32') {
        const result = stopWindowsProcessTree(state.pid);
        if (result.status !== 0) {
            const message = (result.stderr || result.stdout || '').trim();
            console.error(`Failed to stop dev stack (PID ${state.pid}). ${message}`);
            process.exit(result.status || 1);
        }
    } else {
        process.kill(-state.pid, 'SIGTERM');
    }

    removeState();
    console.log(`Stopped dev stack (PID ${state.pid}).`);
}

main();
