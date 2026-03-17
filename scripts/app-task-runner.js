const { spawn } = require('child_process');
const path = require('path');
const { createScriptLogger } = require('./script-logger');
const { printBlankLine } = require('./script-output');

const ROOT = path.resolve(__dirname, '..');
const scriptsLog = createScriptLogger('scripts');

function toWorkspaceApps(appRegistry) {
    return appRegistry.map((app) => ({
        name: app.id,
        workspace: app.workspace,
    }));
}

function parseAppFilter(appFilterRaw) {
    if (!appFilterRaw) return null;
    const names = appFilterRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    return names.length ? new Set(names) : null;
}

function selectAppsByFilter(apps, appFilterRaw) {
    const appFilter = parseAppFilter(appFilterRaw);
    if (!appFilter) return apps;
    return apps.filter((app) => appFilter.has(app.name));
}

function parsePositiveIntEnv(envName, fallbackValue) {
    const raw = process.env[envName];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return fallbackValue;
    }

    const parsed = Number.parseInt(String(raw), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }

    scriptsLog.warn(`Invalid ${envName}="${raw}", using ${fallbackValue}.`);
    return fallbackValue;
}

function getAppNamesCsv(apps) {
    return apps.map((app) => app.name).join(',');
}

function readAppSelection({ apps, envName, defaultValue = null }) {
    const raw = process.env[envName];
    const normalizedRaw = raw && String(raw).trim() ? String(raw).trim() : null;
    const normalizedDefault = defaultValue && String(defaultValue).trim() ? String(defaultValue).trim() : null;
    const filterValue = normalizedRaw || normalizedDefault;

    return {
        rawValue: normalizedRaw,
        filterValue,
        selected: selectAppsByFilter(apps, filterValue),
    };
}

function exitIfEmptySelection({ tag, envName, filterValue, selected }) {
    if (selected.length > 0) return;
    const log = createScriptLogger(tag);
    log.error(`${envName} has no known apps: ${filterValue}`);
    process.exit(1);
}

function getNpmWorkspaceSpawnCommand(workspace, npmArgs) {
    if (process.platform === 'win32') {
        return {
            command: 'cmd.exe',
            args: ['/d', '/s', '/c', 'npm', '-w', workspace, ...npmArgs],
        };
    }

    return {
        command: 'npm',
        args: ['-w', workspace, ...npmArgs],
    };
}

function spawnCommand({
    command,
    args = [],
    stdio = 'inherit',
    cwd = ROOT,
    env = process.env,
    shell = false,
} = {}) {
    return spawn(command, args, {
        shell,
        stdio,
        cwd,
        env: { ...(env || {}) },
        windowsHide: process.platform === 'win32',
    });
}

function spawnWorkspaceTask({
    workspace,
    npmArgs,
    stdio = 'inherit',
    maxOldSpace = null,
    cwd = ROOT,
    env = process.env,
} = {}) {
    const launch = getNpmWorkspaceSpawnCommand(workspace, npmArgs);
    const taskEnv = maxOldSpace ? withMaxOldSpaceEnv(env, maxOldSpace) : { ...(env || {}) };
    return spawnCommand({
        command: launch.command,
        args: launch.args,
        stdio,
        cwd,
        env: taskEnv,
        shell: false,
    });
}

function spawnNodeScript({
    scriptPath,
    scriptArgs = [],
    stdio = 'inherit',
    cwd = ROOT,
    env = process.env,
} = {}) {
    return spawnCommand({
        command: 'node',
        args: [scriptPath, ...scriptArgs],
        stdio,
        cwd,
        env,
        shell: false,
    });
}

function withMaxOldSpaceEnv(baseEnv, maxOldSpace) {
    const env = { ...(baseEnv || {}) };
    const memoryFlag = `--max-old-space-size=${maxOldSpace}`;
    const existingNodeOptions = String(env.NODE_OPTIONS || '').trim();
    const memoryPattern = /--max-old-space-size(?:=|\s+)\d+/;

    if (!existingNodeOptions) {
        return {
            ...env,
            NODE_OPTIONS: memoryFlag,
        };
    }

    if (memoryPattern.test(existingNodeOptions)) {
        return {
            ...env,
            NODE_OPTIONS: existingNodeOptions.replace(memoryPattern, memoryFlag),
        };
    }

    return {
        ...env,
        NODE_OPTIONS: `${existingNodeOptions} ${memoryFlag}`,
    };
}

function toSpawnCommand(commandParts) {
    const [cmd, ...args] = commandParts;
    const base = String(cmd || '').toLowerCase();
    const isNpmLike = base === 'npm' || base === 'npx';

    if (process.platform === 'win32' && isNpmLike) {
        return {
            command: 'cmd.exe',
            args: ['/d', '/s', '/c', cmd, ...args],
        };
    }

    return {
        command: cmd,
        args,
    };
}

function runAppTask({ app, tag, launch, npmArgs, maxOldSpace }) {
    const log = createScriptLogger(tag);
    return new Promise((resolve) => {
        const proc = launch
            ? spawnCommand({
                command: launch.command,
                args: launch.args,
                shell: false,
                stdio: 'inherit',
                cwd: ROOT,
                env: withMaxOldSpaceEnv(process.env, maxOldSpace),
            })
            : spawnWorkspaceTask({
                workspace: app.workspace,
                npmArgs,
                maxOldSpace,
            });

        proc.on('exit', (code) => {
            if (code !== 0) {
                log.error(`${app.name} failed with code ${code}`);
                resolve(false);
                return;
            }
            resolve(true);
        });

        proc.on('error', (err) => {
            log.error(`${app.name} failed: ${err.message}`);
            resolve(false);
        });
    });
}

async function runSequentialAppTask({ tag, actionLabel, apps, maxOldSpace, createLaunch, createNpmArgs, summaryNoun }) {
    const log = createScriptLogger(tag);
    const noun = summaryNoun || `${tag}s`;
    log.info(`Starting ${apps.length} app ${noun} sequentially (${maxOldSpace}MB each)...`);

    let successCount = 0;
    for (const app of apps) {
        printBlankLine();
        log.info(`${actionLabel} ${app.name}...`);
        const launch = createLaunch ? createLaunch(app) : null;
        const npmArgs = createNpmArgs ? createNpmArgs(app) : null;
        const ok = await runAppTask({ app, tag, launch, npmArgs, maxOldSpace });
        if (!ok) break;
        successCount += 1;
    }

    printBlankLine();
    log.info(`Completed ${successCount}/${apps.length} app ${noun}.`);
    if (successCount !== apps.length) {
        process.exit(1);
    }
}

function runMain(tag, main) {
    const log = createScriptLogger(tag);
    Promise.resolve()
        .then(main)
        .catch((err) => {
            log.error(`Unexpected error: ${err.message || err}`);
            process.exit(1);
        });
}

module.exports = {
    toWorkspaceApps,
    selectAppsByFilter,
    parsePositiveIntEnv,
    getAppNamesCsv,
    readAppSelection,
    exitIfEmptySelection,
    getNpmWorkspaceSpawnCommand,
    spawnCommand,
    spawnWorkspaceTask,
    spawnNodeScript,
    withMaxOldSpaceEnv,
    toSpawnCommand,
    runSequentialAppTask,
    runMain,
};
