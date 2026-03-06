const { spawn } = require('child_process');
const path = require('path');

const apps = [
    { name: 'planner', cmd: 'npm run dev:planner', color: '\x1b[36m' }, // Cyan
    { name: 'essay', cmd: 'npm run dev:essay', color: '\x1b[32m' }, // Green
    { name: 'nature', cmd: 'npm run dev:nature', color: '\x1b[33m' }, // Yellow
    { name: 'ops', cmd: 'npm run dev:ops', color: '\x1b[35m' }, // Magenta
    { name: 'edu', cmd: 'npm run dev:edu', color: '\x1b[34m' }, // Blue
    { name: 'student', cmd: 'npm run dev:student', color: '\x1b[37m' }, // White
];

// Configuration
const STAGGER_DELAY_MS = 2500; // 2.5 seconds between each app start
const RESET_COLOR = '\x1b[0m';

console.log(`${RESET_COLOR}Starting ${apps.length} applications with staggered initialization...`);

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startApps() {
    for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        console.log(`${app.color}🚀 [${app.name}] >> Starting initialization...${RESET_COLOR}`);

        // Adjust memory allocation to standard bounds without starving it
        const proc = spawn(app.cmd, {
            shell: true,
            stdio: 'pipe',
            env: {
                ...process.env,
                NODE_OPTIONS: '--max-old-space-size=2048' // Safe boundary, gives breathing room during startup
            }
        });

        proc.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line) => {
                if (line.trim()) {
                    console.log(`${app.color}[${app.name}]${RESET_COLOR} ${line}`);
                }
            });
        });

        proc.stderr.on('data', (data) => {
            console.error(`${app.color}[${app.name} ERROR]${RESET_COLOR} ${data}`);
        });

        if (i < apps.length - 1) {
            console.log(`\n⏳ Waiting ${STAGGER_DELAY_MS / 1000}s before next app to prevent OOM/CPU spikes...\n`);
            await sleep(STAGGER_DELAY_MS);
        }
    }

    console.log(`\n✅ All development servers started successfully!`);
}

startApps().catch((err) => {
    console.error('Failed to start apps:', err);
});
