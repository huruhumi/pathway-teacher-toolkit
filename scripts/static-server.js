const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_MIME_TYPES = Object.freeze({
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
});

function startStaticServer({
    rootDir,
    port,
    defaultDocument = 'index.html',
    mimeTypes = DEFAULT_MIME_TYPES,
    onReady,
    onPortInUse,
    onError,
} = {}) {
    return new Promise((resolve) => {
        let resolved = false;

        function resolveOnce(value) {
            if (resolved) return;
            resolved = true;
            resolve(value);
        }

        const server = http.createServer((req, res) => {
            const requestPath = String(req.url || '/').split('?')[0];
            const normalizedPath = requestPath === '/' ? `/${defaultDocument}` : requestPath;
            const filePath = path.join(rootDir, normalizedPath);
            const ext = path.extname(filePath);

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }

                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });

        server.on('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                onPortInUse?.(port);
            } else {
                onError?.(err);
            }
            resolveOnce(null);
        });

        server.listen(port, () => {
            onReady?.(port);
            resolveOnce(server);
        });
    });
}

module.exports = {
    startStaticServer,
    DEFAULT_MIME_TYPES,
};
