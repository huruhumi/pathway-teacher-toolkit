const fs = require('fs');
const { spawn } = require('child_process');
const {
    ROOT,
    OUT_LOG,
    ERR_LOG,
    ensureRuntimeDir,
    readState,
    writeState,
    removeState,
    isPidRunning,
    getBackgroundLaunch,
} = require('./dev-background-utils');

function main() {
    const existing = readState();
    if (existing && isPidRunning(existing.pid)) {
        console.log(`Dev stack is already running (PID ${existing.pid}).`);
        console.log(`Status: npm run dev:status`);
        console.log(`Stop:   npm run dev:down`);
        return;
    }

    if (existing) {
        removeState();
    }

    ensureRuntimeDir();

    const stdoutFd = fs.openSync(OUT_LOG, 'a');
    const stderrFd = fs.openSync(ERR_LOG, 'a');
    const launch = getBackgroundLaunch();
    const child = spawn(launch.command, launch.args, {
        cwd: ROOT,
        detached: true,
        stdio: ['ignore', stdoutFd, stderrFd],
        windowsHide: true,
        env: { ...process.env },
    });

    child.unref();
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);

    writeState({
        pid: child.pid,
        startedAt: new Date().toISOString(),
        command: [launch.command, ...launch.args].join(' '),
        outLog: OUT_LOG,
        errLog: ERR_LOG,
    });

    console.log(`Dev stack started in the background (PID ${child.pid}).`);
    console.log('Landing: http://localhost:3000/');
    console.log('Status:  npm run dev:status');
    console.log('Stop:    npm run dev:down');
}

main();
