const {
    classifyTargetsByHealth,
    waitForTargetsReady,
} = require('./url-health');
const { waitForChildExit } = require('./process-lifecycle');
const {
    toSpawnCommand,
    spawnCommand,
    spawnNodeScript,
} = require('./app-task-runner');

function createTargetStatusHandlers(log) {
    return {
        onTargetReady(target) {
            log.info(`${target.name} is ready: ${target.url}`);
        },
        onPendingTargets(pendingNames) {
            log.info(`Waiting for: ${pendingNames.join(', ')}`);
        },
    };
}

async function ensureTargetsReady({
    targets,
    devEnv,
    devScriptPath,
    rootDir,
    maxWaitMs,
    pollIntervalMs,
    log,
} = {}) {
    const handlers = createTargetStatusHandlers(log);
    const { pending } = await classifyTargetsByHealth(targets, {
        // Run one immediate pass so scan can reuse already-running dev servers.
        // This avoids noisy "port already in use" errors during repeated scans.
        onReady: handlers.onTargetReady,
    });

    if (pending.length === 0) {
        log.info('All target apps are already running. Reusing existing servers.');
        return null;
    }

    const pendingAppNames = pending.map((target) => target.name).join(',');
    const pendingDevEnv = {
        ...devEnv,
        DEV_APPS: pendingAppNames,
    };

    log.info('Starting all apps for integrated scanning...');
    const devProc = spawnNodeScript({
        scriptPath: devScriptPath,
        stdio: 'inherit',
        cwd: rootDir,
        env: pendingDevEnv,
    });

    log.info(`Dev launcher target apps: ${pendingAppNames}`);

    await waitForTargetsReady(targets, {
        maxWaitMs,
        pollIntervalMs,
        onReady: handlers.onTargetReady,
        onPending: handlers.onPendingTargets,
    });

    return devProc;
}

async function runScanCommand({
    scanCommand,
    rootDir,
    env,
    log,
} = {}) {
    log.info(`Running scan command: ${scanCommand.join(' ')}`);

    const launch = toSpawnCommand(scanCommand);
    const scanProc = spawnCommand({
        command: launch.command,
        args: launch.args,
        stdio: 'inherit',
        cwd: rootDir,
        env,
        shell: false,
    });

    return waitForChildExit(scanProc, {
        onError(err) {
            log.error(`Failed to start scan command: ${err.message}`);
        },
    });
}

module.exports = {
    ensureTargetsReady,
    runScanCommand,
};
