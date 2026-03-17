const path = require('path');
const { SCRIPT_DEFAULTS } = require('./script-defaults');
const {
    parsePositiveIntEnv,
    spawnWorkspaceTask,
    spawnNodeScript,
    runMain,
} = require('./app-task-runner');
const {
    terminateChild,
    createIdempotentShutdown,
    registerSignalExitHandlers,
    waitForChildExit,
} = require('./process-lifecycle');
const { createScriptLogger } = require('./script-logger');

const ROOT = path.resolve(__dirname, '..');
const log = createScriptLogger('dev-nature');
const maxOldSpace = parsePositiveIntEnv('DEV_NATURE_MAX_OLD_SPACE', SCRIPT_DEFAULTS.devNature.maxOldSpaceMb);

function startVite() {
    return spawnWorkspaceTask({
        workspace: 'apps/nature-compass',
        npmArgs: ['run', 'dev'],
        maxOldSpace,
        env: process.env,
        cwd: ROOT,
    });
}

function startProxy() {
    const proxy = spawnNodeScript({
        scriptPath: 'scripts/nlm-proxy.mjs',
        stdio: 'inherit',
        cwd: ROOT,
    });
    proxy.on('error', () => {
        log.warn('nlm-proxy not available, skipping.');
    });
    return proxy;
}

async function main() {
    const vite = startVite();
    const proxy = startProxy();

    const shutdown = createIdempotentShutdown(() => {
        terminateChild(vite);
        terminateChild(proxy);
    });

    registerSignalExitHandlers({
        shutdown,
        sigintExitCode: 0,
        sigtermExitCode: 143,
    });

    const exitCode = await waitForChildExit(vite, {
        onError(err) {
            log.error(`Failed to start nature dev server: ${err.message}`);
        },
    });

    shutdown();
    process.exit(exitCode);
}

runMain('dev-nature', main);
