const path = require('path');
const { SCRIPT_DEFAULTS } = require('./script-defaults');
const {
    parsePositiveIntEnv,
    getAppNamesCsv,
    readAppSelection,
    exitIfEmptySelection,
    runMain,
} = require('./app-task-runner');
const { createScriptLogger } = require('./script-logger');
const { toScanTargets } = require('./app-targets');
const {
    terminateChild,
    createIdempotentShutdown,
    registerSignalExitHandlers,
} = require('./process-lifecycle');
const { ensureTargetsReady, runScanCommand } = require('./scan-workflow');

const ROOT = path.resolve(__dirname, '..');
const DEV_SCRIPT = path.join(ROOT, 'scripts', 'dev-staggered.js');
const MAX_WAIT_MS = parsePositiveIntEnv('SCAN_WAIT_MS', SCRIPT_DEFAULTS.scan.maxWaitMs);
const POLL_INTERVAL_MS = SCRIPT_DEFAULTS.scan.pollIntervalMs;
const log = createScriptLogger('scan');

const ALL_TARGETS = toScanTargets({ host: SCRIPT_DEFAULTS.scan.targetHost });
const DEFAULT_DEV_APPS = getAppNamesCsv(ALL_TARGETS);

async function main() {
    const scanCommand = process.argv.slice(2);

    if (scanCommand.length === 0) {
        log.error('Missing scan command. Example: npm run test:scan -- npx playwright test');
        process.exit(1);
    }

    const { filterValue: devApps, selected: targets } = readAppSelection({
        apps: ALL_TARGETS,
        envName: 'DEV_APPS',
        defaultValue: DEFAULT_DEV_APPS,
    });

    exitIfEmptySelection({
        tag: 'scan',
        envName: 'DEV_APPS',
        filterValue: devApps,
        selected: targets,
    });

    const devEnv = {
        ...process.env,
        DEV_APPS: devApps,
    };

    let devProc = null;

    const shutdown = createIdempotentShutdown(() => {
        terminateChild(devProc);
    });
    registerSignalExitHandlers({
        shutdown,
        sigintExitCode: 130,
        sigtermExitCode: 143,
    });

    try {
        devProc = await ensureTargetsReady({
            targets,
            devEnv,
            devScriptPath: DEV_SCRIPT,
            rootDir: ROOT,
            maxWaitMs: MAX_WAIT_MS,
            pollIntervalMs: POLL_INTERVAL_MS,
            log,
        });
        const exitCode = await runScanCommand({
            scanCommand,
            rootDir: ROOT,
            env: process.env,
            log,
        });

        shutdown();
        process.exit(exitCode);
    } catch (err) {
        log.error(err.message);
        shutdown();
        process.exit(1);
    }
}

runMain('scan', main);
