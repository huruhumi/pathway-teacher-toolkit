const { APPS } = require('./app-registry');
const { SCRIPT_DEFAULTS } = require('./script-defaults');

const DEFAULT_APP_COLORS = {
    planner: '\x1b[36m',
    essay: '\x1b[32m',
    nature: '\x1b[33m',
    ops: '\x1b[35m',
    edu: '\x1b[34m',
    student: '\x1b[37m',
    landing: '\x1b[95m',
};

function buildHttpUrl(host, port, pathname) {
    return `http://${host}:${port}${pathname}`;
}

function toDevLauncherApps({ apps = APPS, colorMap = DEFAULT_APP_COLORS } = {}) {
    return apps.map((app) => ({
        name: app.id,
        workspace: app.workspace,
        port: app.devPort,
        path: app.scanPath,
        color: colorMap[app.id] || '\x1b[37m',
    }));
}

function toScanTargets({ apps = APPS, host = SCRIPT_DEFAULTS.scan.targetHost } = {}) {
    return apps.map((app) => ({
        name: app.id,
        url: buildHttpUrl(host, app.devPort, app.scanPath),
    }));
}

function toNamedUrls({ apps = [], host = 'localhost' } = {}) {
    return apps.map((app) => ({
        name: app.name,
        url: buildHttpUrl(host, app.port, app.path),
    }));
}

function toBuildAssemblyApps({ apps = APPS } = {}) {
    return apps.map((app) => ({
        sourceDir: app.distSource,
        targetDir: app.distTarget,
    }));
}

module.exports = {
    toDevLauncherApps,
    toScanTargets,
    toNamedUrls,
    toBuildAssemblyApps,
};
