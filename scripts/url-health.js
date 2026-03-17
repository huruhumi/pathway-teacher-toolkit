const http = require('http');
const { SCRIPT_DEFAULTS } = require('./script-defaults');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkUrl(url, { timeoutMs = SCRIPT_DEFAULTS.scan.healthCheckTimeoutMs } = {}) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            res.resume();
            resolve(Boolean(res.statusCode && res.statusCode < 500));
        });

        req.on('error', () => resolve(false));
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function classifyTargetsByHealth(targets, { check = checkUrl, onReady } = {}) {
    const ready = [];
    const pending = [];

    for (const target of targets) {
        const ok = await check(target.url);
        if (ok) {
            ready.push(target);
            onReady?.(target);
        } else {
            pending.push(target);
        }
    }

    return { ready, pending };
}

async function waitForTargetsReady(
    targets,
    {
        maxWaitMs = SCRIPT_DEFAULTS.scan.maxWaitMs,
        pollIntervalMs = SCRIPT_DEFAULTS.scan.pollIntervalMs,
        check = checkUrl,
        onReady,
        onPending,
    } = {}
) {
    const deadline = Date.now() + maxWaitMs;
    const pending = new Set(targets.map((target) => target.name));

    while (pending.size > 0 && Date.now() < deadline) {
        for (const target of targets) {
            if (!pending.has(target.name)) continue;
            const ok = await check(target.url);
            if (ok) {
                pending.delete(target.name);
                onReady?.(target);
            }
        }

        if (pending.size > 0) {
            onPending?.(Array.from(pending));
            await sleep(pollIntervalMs);
        }
    }

    if (pending.size > 0) {
        throw new Error(`Timed out waiting for apps: ${Array.from(pending).join(', ')}`);
    }
}

module.exports = {
    checkUrl,
    classifyTargetsByHealth,
    waitForTargetsReady,
};
