const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

/**
 * Staggered Dev Server Launcher
 *
 * 1. Starts a static file server for the landing page on port 3000
 * 2. Starts each Vite dev server one at a time, waiting for the previous one
 *    to finish its startup (detected by "ready in" output) before launching
 *    the next. This prevents OOM by avoiding concurrent pre-bundling.
 *
 * Memory is capped at 512MB per app (3GB total for 6 apps).
 */

const ROOT = path.resolve(__dirname, '..');

const apps = [
    { name: 'planner', workspace: 'apps/esl-planner', color: '\x1b[36m' },
    { name: 'essay', workspace: 'apps/essay-lab', color: '\x1b[32m' },
    { name: 'nature', workspace: 'apps/nature-compass', color: '\x1b[33m' },
    { name: 'ops', workspace: 'apps/rednote-ops', color: '\x1b[35m' },
    { name: 'edu', workspace: 'apps/edu-hub', color: '\x1b[34m' },
    { name: 'student', workspace: 'apps/student-portal', color: '\x1b[37m' },
];

const RESET = '\x1b[0m';
const MAX_WAIT_MS = 30000; // max 30s to wait for each app's "ready" signal

// --- Landing page static server ---
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.json': 'application/json', '.ico': 'image/x-icon',
};

function startLandingServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let url = req.url.split('?')[0];
            if (url === '/') url = '/index.html';
            const filePath = path.join(ROOT, url);
            const ext = path.extname(filePath);
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
                res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(3000, () => {
            console.log(`\x1b[95m[landing]\x1b[0m ✅ Static server ready at http://localhost:3000/\n`);
            resolve(server);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`\x1b[95m[landing]\x1b[0m ⚠️  Port 3000 in use, skipping landing server\n`);
            } else {
                console.error(`\x1b[95m[landing]\x1b[0m ❌ ${err.message}\n`);
            }
            resolve(null);
        });
    });
}

console.log(`${RESET}Starting landing page + ${apps.length} dev servers sequentially (512MB each)...\n`);

function startApp(app) {
    return new Promise((resolve, reject) => {
        const proc = spawn('npm', ['-w', app.workspace, 'run', 'dev'], {
            shell: true,
            stdio: 'pipe',
            cwd: ROOT,
            env: {
                ...process.env,
                NODE_OPTIONS: '--max-old-space-size=512',
            },
        });

        let resolved = false;

        // Auto-resolve after timeout even if "ready" not detected
        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log(`${app.color}[${app.name}]${RESET} ⏰ Timeout reached, proceeding...\n`);
                resolve(proc);
            }
        }, MAX_WAIT_MS);

        proc.stdout.on('data', (data) => {
            const text = data.toString();
            text.split('\n').forEach((line) => {
                if (line.trim()) {
                    console.log(`${app.color}[${app.name}]${RESET} ${line}`);
                }
            });
            // Wait for Vite's "ready in" message before starting the next app
            if (!resolved && text.includes('ready in')) {
                resolved = true;
                clearTimeout(timeout);
                console.log(`${app.color}[${app.name}]${RESET} ✅ Ready!\n`);
                resolve(proc);
            }
        });

        proc.stderr.on('data', (data) => {
            const text = data.toString();
            // Filter out Vite's normal "re-optimizing" messages
            if (text.includes('Re-optimizing') || text.includes('lockfile')) return;
            console.error(`${app.color}[${app.name} ERR]${RESET} ${text}`);
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                console.error(`${app.color}[${app.name}]${RESET} ❌ Failed to start: ${err.message}`);
                // Don't reject — let other apps continue
                resolve(null);
            }
        });

        proc.on('exit', (code) => {
            if (code !== null && code !== 0 && !resolved) {
                clearTimeout(timeout);
                resolved = true;
                console.error(`${app.color}[${app.name}]${RESET} ❌ Exited with code ${code}`);
                resolve(null);
            }
        });
    });
}

async function main() {
    // Start landing page first
    const landingServer = await startLandingServer();

    // Then start app dev servers sequentially
    const procs = [];
    for (const app of apps) {
        console.log(`🚀 Starting [${app.name}]...`);
        const proc = await startApp(app);
        if (proc) procs.push(proc);
    }
    console.log(`\n✅ Landing page + ${procs.length}/${apps.length} dev servers running.\n`);
    console.log(`   Landing:  http://localhost:3000/`);
    console.log(`   Planner:  http://localhost:3001/planner/`);
    console.log(`   Essay:    http://localhost:3002/essay-lab/`);
    console.log(`   Nature:   http://localhost:3003/nature-compass/`);
    console.log(`   Ops:      http://localhost:3005/academy-ops/`);
    console.log(`   Edu:      http://localhost:3006/edu-hub/`);
    console.log(`   Student:  http://localhost:3007/student-portal/\n`);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down all dev servers...');
        procs.forEach((p) => p.kill());
        if (landingServer) landingServer.close();
        process.exit(0);
    });
}

main().catch(console.error);

