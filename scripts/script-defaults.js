const SCRIPT_DEFAULTS = Object.freeze({
    build: Object.freeze({
        maxOldSpaceMb: 4096,
    }),
    typecheck: Object.freeze({
        maxOldSpaceMb: 2048,
    }),
    dev: Object.freeze({
        maxOldSpaceMb: 1024,
        startupWaitMs: 30000,
        landingPort: 3000,
        landingUrl: 'http://localhost:3000/',
        readyMarkers: Object.freeze(['ready in', 'Local:']),
    }),
    devNature: Object.freeze({
        maxOldSpaceMb: 1024,
    }),
    scan: Object.freeze({
        maxWaitMs: 180000,
        pollIntervalMs: 1500,
        healthCheckTimeoutMs: 5000,
        targetHost: '127.0.0.1',
    }),
});

module.exports = {
    SCRIPT_DEFAULTS,
};
