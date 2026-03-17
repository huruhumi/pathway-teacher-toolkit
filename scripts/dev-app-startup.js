const {
    logWithColoredTag,
    logErrorWithColoredTag,
} = require('./dev-log-tags');

function waitForAppStartup({
    proc,
    app,
    isReadyOutput,
    maxWaitMs,
    ignoreStderrPatterns = [],
} = {}) {
    return new Promise((resolve) => {
        let resolved = false;

        const timeout = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            logWithColoredTag({
                color: app.color,
                name: app.name,
                message: 'Startup timeout reached, continuing...\n',
            });
            resolve(proc);
        }, maxWaitMs);

        proc.stdout.on('data', (data) => {
            const text = data.toString();
            text.split('\n').forEach((line) => {
                if (!line.trim()) return;
                logWithColoredTag({
                    color: app.color,
                    name: app.name,
                    message: line,
                });
            });

            if (!resolved && isReadyOutput(text)) {
                resolved = true;
                clearTimeout(timeout);
                logWithColoredTag({
                    color: app.color,
                    name: app.name,
                    message: 'Ready\n',
                });
                resolve(proc);
            }
        });

        proc.stderr.on('data', (data) => {
            const text = data.toString();
            if (ignoreStderrPatterns.some((pattern) => text.includes(pattern))) return;
            logErrorWithColoredTag({
                color: app.color,
                name: app.name,
                suffix: ' ERR',
                message: text,
            });
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            if (resolved) return;
            resolved = true;
            logErrorWithColoredTag({
                color: app.color,
                name: app.name,
                message: `Failed to start: ${err.message}`,
            });
            resolve(null);
        });

        proc.on('exit', (code) => {
            if (resolved || code === 0 || code === null) return;
            clearTimeout(timeout);
            resolved = true;
            logErrorWithColoredTag({
                color: app.color,
                name: app.name,
                message: `Exited with code ${code}`,
            });
            resolve(null);
        });
    });
}

module.exports = {
    waitForAppStartup,
};
