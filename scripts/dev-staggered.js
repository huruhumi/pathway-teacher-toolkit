const path = require('path');
const { spawnSync } = require('child_process');
const { SCRIPT_DEFAULTS } = require('./script-defaults');
const {
    parsePositiveIntEnv,
    readAppSelection,
    spawnWorkspaceTask,
    runMain,
} = require('./app-task-runner');
const { createScriptLogger } = require('./script-logger');
const {
    terminateChildren,
    createIdempotentShutdown,
    registerSignalExitHandlers,
} = require('./process-lifecycle');
const { parseReadyMarkers, createReadinessDetector } = require('./dev-readiness');
const { toDevLauncherApps, toNamedUrls } = require('./app-targets');
const { startStaticServer } = require('./static-server');
const { waitForAppStartup } = require('./dev-app-startup');
const { printBlankLine, printSection, printAlignedUrls } = require('./script-output');
const { logWithColoredTag, logErrorWithColoredTag } = require('./dev-log-tags');

/**
 * Staggered Dev Server Launcher
 *
 * 1. Starts a static file server for the landing page on port 3000
 * 2. Starts Vite dev servers one by one to reduce startup memory pressure
 */

const ROOT = path.resolve(__dirname, '..');
const log = createScriptLogger('dev');

function shouldDisableEsbuild() {
    if (process.env.VITE_DISABLE_ESBUILD) return true;
    const probe = spawnSync(process.execPath, ['-v'], { stdio: 'ignore' });
    return Boolean(probe?.error && probe.error.code === 'EPERM');
}

if (shouldDisableEsbuild()) {
    process.env.VITE_DISABLE_ESBUILD = '1';
    log.warn('Detected child process spawn restrictions. Disabling esbuild for dev servers.');
}

const apps = toDevLauncherApps();

const maxOldSpace = parsePositiveIntEnv('DEV_MAX_OLD_SPACE', SCRIPT_DEFAULTS.dev.maxOldSpaceMb);
const { selected: filteredApps } = readAppSelection({
    apps,
    envName: 'DEV_APPS',
});
const readyMarkers = parseReadyMarkers(process.env.DEV_READY_MARKERS, SCRIPT_DEFAULTS.dev.readyMarkers);
const isReadyOutput = createReadinessDetector({ markers: readyMarkers });

const LANDING_COLOR = '\x1b[95m';
const LANDING_PORT = SCRIPT_DEFAULTS.dev.landingPort;
const MAX_WAIT_MS = SCRIPT_DEFAULTS.dev.startupWaitMs;

function startLandingServer() {
    return startStaticServer({
        rootDir: ROOT,
        port: LANDING_PORT,
        onReady() {
            logWithColoredTag({
                color: LANDING_COLOR,
                name: 'landing',
                message: `Static server ready at ${SCRIPT_DEFAULTS.dev.landingUrl}\n`,
            });
        },
        onPortInUse(port) {
            logWithColoredTag({
                color: LANDING_COLOR,
                name: 'landing',
                message: `Port ${port} already in use, skipping landing server\n`,
            });
        },
        onError(err) {
            logErrorWithColoredTag({
                color: LANDING_COLOR,
                name: 'landing',
                message: `Failed to start: ${err.message}\n`,
            });
        },
    });
}

function startApp(app) {
    const proc = spawnWorkspaceTask({
        workspace: app.workspace,
        npmArgs: ['run', 'dev'],
        stdio: 'pipe',
        maxOldSpace,
        env: process.env,
    });

    return waitForAppStartup({
        proc,
        app,
        isReadyOutput,
        maxWaitMs: MAX_WAIT_MS,
        ignoreStderrPatterns: ['Re-optimizing', 'lockfile'],
    });
}

async function main() {
    printSection(`Starting landing page + ${filteredApps.length} dev servers sequentially (${maxOldSpace}MB each)\n`);
    log.info(`Ready markers: ${readyMarkers.join(' | ')}`);
    printBlankLine();

    const landingServer = await startLandingServer();
    const procs = [];

    for (const app of filteredApps) {
        printSection(`Starting [${app.name}]...`);
        const proc = await startApp(app);
        if (proc) procs.push(proc);
    }

    printSection(`\nRunning ${procs.length}/${filteredApps.length} app dev servers`);
    printSection(`Landing:  ${SCRIPT_DEFAULTS.dev.landingUrl}`);
    printAlignedUrls(toNamedUrls({ apps: filteredApps, host: 'localhost' }));
    printBlankLine();

    const shutdown = createIdempotentShutdown(() => {
        console.log('\nShutting down all dev servers...');
        terminateChildren(procs);
        if (landingServer) landingServer.close();
    });
    registerSignalExitHandlers({
        shutdown,
        sigintExitCode: 0,
        sigtermExitCode: 143,
    });
}

runMain('dev', main);
