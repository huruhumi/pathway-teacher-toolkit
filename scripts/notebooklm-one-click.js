const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'packages', 'shared', 'config', 'textbook-level-registry.json');
const BULK_IMPORT_SCRIPT = path.join(ROOT, 'scripts', 'notebooklm-bulk-import-drive.js');

const PRESETS = {
    all: null,
    trailblazer: [
        'trailblazer-starter',
        'trailblazer-1',
        'trailblazer-2',
        'trailblazer-3',
        'trailblazer-4',
        'trailblazer-5',
        'trailblazer-6',
    ],
    reflect: ['reflect-1', 'reflect-2', 'reflect-3', 'reflect-4', 'reflect-5', 'reflect-6'],
    pathways: ['pathways-f', 'pathways-1', 'pathways-2', 'pathways-3', 'pathways-4'],
    core: [
        'trailblazer-starter',
        'trailblazer-1',
        'trailblazer-2',
        'trailblazer-3',
        'trailblazer-4',
        'reflect-3',
        'reflect-4',
        'reflect-5',
        'pathways-3',
        'pathways-4',
    ],
};

function parseArgs(argv) {
    const args = {
        selection: 'core',
        queryPrefix: process.env.NLM_QUERY_PREFIX || 'Pathway Academy materials',
        dryRun: false,
        skipRefresh: false,
        manualSelect: false,
        querySet: 'both',
    };

    const positional = [];
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--query-prefix') {
            args.queryPrefix = (argv[i + 1] || args.queryPrefix).trim();
            i += 1;
        } else if (token === '--dry-run') {
            args.dryRun = true;
        } else if (token === '--skip-refresh') {
            args.skipRefresh = true;
        } else if (token === '--manual-select') {
            args.manualSelect = true;
        } else if (token === '--import-all') {
            args.manualSelect = false;
        } else if (token === '--query-set') {
            const value = (argv[i + 1] || 'both').trim().toLowerCase();
            args.querySet = ['both', 'assessment', 'materials'].includes(value) ? value : 'both';
            i += 1;
        } else if (token === '--help' || token === '-h') {
            printHelp();
            process.exit(0);
        } else if (!token.startsWith('--')) {
            positional.push(token.trim());
        }
    }

    if (positional.length > 0) {
        args.selection = positional[0];
    }

    return args;
}

function printHelp() {
    console.log('NotebookLM one-click import');
    console.log('');
    console.log('Usage:');
    console.log('  npm run nlm                      # default preset: core');
    console.log('  npm run nlm -- trailblazer       # whole textbook family');
    console.log('  npm run nlm -- reflect');
    console.log('  npm run nlm -- pathways');
    console.log('  npm run nlm -- all');
    console.log('  npm run nlm -- trailblazer-1');
    console.log('  npm run nlm -- trailblazer-1,reflect-3,pathways-4');
    console.log('  npm run nlm -- core --dry-run');
    console.log('  npm run nlm -- core --manual-select');
    console.log('');
    console.log('Options:');
    console.log('  --query-prefix "Pathway Academy materials"');
    console.log('  --dry-run');
    console.log('  --skip-refresh');
    console.log('  --manual-select');
    console.log('  --import-all');
    console.log('  --query-set both|assessment|materials');
}

function getReadyLevels() {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return registry.filter((entry) => entry.status === 'ready').map((entry) => entry.levelKey);
}

function resolveSelection(selection, readySet) {
    if (selection === 'all') return [...readySet];
    if (PRESETS[selection]) {
        return PRESETS[selection].filter((levelKey) => readySet.has(levelKey));
    }

    const requested = selection.split(',').map((item) => item.trim()).filter(Boolean);
    if (requested.length === 0) return [];
    return requested.filter((levelKey) => readySet.has(levelKey));
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const readyLevels = getReadyLevels();
    const readySet = new Set(readyLevels);
    const selectedLevels = resolveSelection(args.selection, readySet);

    if (selectedLevels.length === 0) {
        console.error(`No ready levels matched selection: "${args.selection}"`);
        console.error(`Available presets: ${Object.keys(PRESETS).join(', ')}, all`);
        process.exit(1);
    }

    const importArgs = [BULK_IMPORT_SCRIPT, '--query-prefix', args.queryPrefix];
    if (args.selection !== 'all') {
        importArgs.push('--only', selectedLevels.join(','));
    }
    if (args.dryRun) importArgs.push('--dry-run');
    if (args.skipRefresh) importArgs.push('--skip-refresh');
    if (args.manualSelect) importArgs.push('--manual-select');
    if (args.querySet) importArgs.push('--query-set', args.querySet);

    console.log('[nlm] selection:', args.selection);
    console.log('[nlm] levels:', selectedLevels.join(', '));
    console.log('[nlm] query-prefix:', args.queryPrefix);
    console.log('[nlm] dry-run:', args.dryRun ? 'yes' : 'no');
    console.log('[nlm] skip-refresh:', args.skipRefresh ? 'yes' : 'no');
    console.log('[nlm] manual-select:', args.manualSelect ? 'yes' : 'no');
    console.log('[nlm] query-set:', args.querySet);

    const result = spawnSync('node', importArgs, {
        cwd: ROOT,
        stdio: 'inherit',
        encoding: 'utf8',
    });

    process.exit(result.status || 0);
}

main();
