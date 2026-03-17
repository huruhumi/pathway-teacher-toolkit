function isProcessRunning(child) {
    if (!child) return false;
    return child.exitCode === null && child.signalCode === null;
}

function terminateChild(
    child,
    {
        graceMs = 3000,
        softSignal = 'SIGINT',
        hardSignal = 'SIGTERM',
    } = {}
) {
    if (!isProcessRunning(child)) return;

    try {
        child.kill(softSignal);
    } catch {
        return;
    }

    setTimeout(() => {
        if (!isProcessRunning(child)) return;
        try {
            child.kill(hardSignal);
        } catch {
            // no-op
        }
    }, graceMs);
}

function terminateChildren(children, options) {
    (children || []).forEach((child) => terminateChild(child, options));
}

function createIdempotentShutdown(handler) {
    let shuttingDown = false;
    return function shutdown() {
        if (shuttingDown) return false;
        shuttingDown = true;
        handler?.();
        return true;
    };
}

function registerSignalHandlers({ onSigint, onSigterm }) {
    const handleSigint = onSigint || (() => {});
    const handleSigterm = onSigterm || (() => {});

    process.on('SIGINT', handleSigint);
    process.on('SIGTERM', handleSigterm);

    return () => {
        process.removeListener('SIGINT', handleSigint);
        process.removeListener('SIGTERM', handleSigterm);
    };
}

function registerSignalExitHandlers({
    shutdown,
    sigintExitCode = 130,
    sigtermExitCode = 143,
} = {}) {
    return registerSignalHandlers({
        onSigint() {
            shutdown?.();
            process.exit(sigintExitCode);
        },
        onSigterm() {
            shutdown?.();
            process.exit(sigtermExitCode);
        },
    });
}

function waitForChildExit(child, { onError } = {}) {
    return new Promise((resolve) => {
        child.on('exit', (code) => resolve(code ?? 1));
        child.on('error', (err) => {
            onError?.(err);
            resolve(1);
        });
    });
}

module.exports = {
    terminateChild,
    terminateChildren,
    createIdempotentShutdown,
    registerSignalHandlers,
    registerSignalExitHandlers,
    waitForChildExit,
};
