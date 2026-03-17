const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'packages', 'shared', 'config', 'textbook-level-registry.json');
const BULK_IMPORT_SCRIPT = path.join(ROOT, 'scripts', 'notebooklm-bulk-import-drive.js');

const PRESETS = {
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
};

function parseArgs(argv) {
    const args = {
        queryPrefix: process.env.NLM_QUERY_PREFIX || 'Pathway Academy materials',
        dryRun: false,
        skipRefresh: false,
        preset: '',
        only: '',
        manualSelect: true,
        querySet: 'both',
    };

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
        } else if (token === '--preset') {
            args.preset = (argv[i + 1] || '').trim();
            i += 1;
        } else if (token === '--only') {
            args.only = (argv[i + 1] || '').trim();
            i += 1;
        } else if (token === '--help' || token === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    return args;
}

function printHelp() {
    console.log('NotebookLM interactive picker');
    console.log('');
    console.log('Usage:');
    console.log('  npm run nlm:pick');
    console.log('  npm run nlm:pick -- --preset core');
    console.log('  npm run nlm:pick -- --preset trailblazer --dry-run');
    console.log('  npm run nlm:pick -- --only trailblazer-starter,trailblazer-1');
    console.log('');
    console.log('Options:');
    console.log('  --query-prefix "Pathway Academy materials"');
    console.log('  --dry-run');
    console.log('  --skip-refresh');
    console.log('  --manual-select     # default for nlm:pick');
    console.log('  --import-all');
    console.log('  --query-set both|assessment|materials');
    console.log('  --preset core|trailblazer|reflect|pathways|all');
    console.log('  --only levelA,levelB');
}

function readReadyRegistry() {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return registry.filter((entry) => entry.status === 'ready');
}

function familyFromKey(levelKey) {
    if (levelKey.startsWith('trailblazer-')) return 'trailblazer';
    if (levelKey.startsWith('reflect-')) return 'reflect';
    if (levelKey.startsWith('pathways-')) return 'pathways';
    return 'other';
}

function filterReady(keys, readySet) {
    return keys.filter((key) => readySet.has(key));
}

function parseCsv(text) {
    return text.split(',').map((s) => s.trim()).filter(Boolean);
}

async function pickSelectionInteractively(readyEntries) {
    const readySet = new Set(readyEntries.map((entry) => entry.levelKey));
    const rl = readline.createInterface({ input, output });

    try {
        console.log('');
        console.log('Choose import scope:');
        console.log('1) core progression (recommended)');
        console.log('2) one textbook family');
        console.log('3) custom level keys');
        console.log('4) all ready levels');
        const scope = (await rl.question('Enter 1/2/3/4 [1]: ')).trim() || '1';

        if (scope === '1') {
            return filterReady(PRESETS.core, readySet);
        }

        if (scope === '4') {
            return readyEntries.map((entry) => entry.levelKey);
        }

        if (scope === '2') {
            console.log('');
            console.log('Pick textbook family:');
            console.log('1) trailblazer');
            console.log('2) reflect');
            console.log('3) pathways');
            const familyChoice = (await rl.question('Enter 1/2/3 [1]: ')).trim() || '1';
            const familyMap = {
                '1': 'trailblazer',
                '2': 'reflect',
                '3': 'pathways',
            };
            const family = familyMap[familyChoice] || 'trailblazer';
            return readyEntries
                .filter((entry) => familyFromKey(entry.levelKey) === family)
                .map((entry) => entry.levelKey);
        }

        console.log('');
        console.log('Available levels:');
        readyEntries.forEach((entry, index) => {
            console.log(`${index + 1}) ${entry.levelKey} - ${entry.displayName}`);
        });
        console.log('');
        const typed = await rl.question('Type numbers or level keys, comma-separated: ');
        if (!typed.trim()) return [];

        const selected = [];
        for (const token of parseCsv(typed)) {
            const asIndex = Number(token);
            if (!Number.isNaN(asIndex) && asIndex >= 1 && asIndex <= readyEntries.length) {
                selected.push(readyEntries[asIndex - 1].levelKey);
            } else if (readySet.has(token)) {
                selected.push(token);
            }
        }
        return [...new Set(selected)];
    } finally {
        rl.close();
    }
}

async function askImportOptionsInteractively(defaults) {
    const rl = readline.createInterface({ input, output });
    try {
        console.log('');
        console.log('Choose source type:');
        console.log('1) both (assessment + materials)');
        console.log('2) assessment only');
        console.log('3) materials only');
        const queryChoice = (await rl.question('Enter 1/2/3 [1]: ')).trim() || '1';
        const querySetMap = { '1': 'both', '2': 'assessment', '3': 'materials' };
        const querySet = querySetMap[queryChoice] || defaults.querySet;

        console.log('');
        console.log('Import mode:');
        console.log('1) manual select each research result (recommended)');
        console.log('2) import all');
        const modeChoice = (await rl.question('Enter 1/2 [1]: ')).trim() || '1';
        const manualSelect = modeChoice !== '2';

        return { querySet, manualSelect };
    } finally {
        rl.close();
    }
}

function runBulkImport({ queryPrefix, dryRun, skipRefresh, selectedLevels, manualSelect, querySet }) {
    const cmdArgs = [BULK_IMPORT_SCRIPT, '--query-prefix', queryPrefix];
    if (selectedLevels.length > 0) {
        cmdArgs.push('--only', selectedLevels.join(','));
    }
    if (dryRun) cmdArgs.push('--dry-run');
    if (skipRefresh) cmdArgs.push('--skip-refresh');
    if (manualSelect) cmdArgs.push('--manual-select');
    if (querySet) cmdArgs.push('--query-set', querySet);

    console.log('');
    console.log('[nlm:pick] levels:', selectedLevels.join(', '));
    console.log('[nlm:pick] query-prefix:', queryPrefix);
    console.log('[nlm:pick] dry-run:', dryRun ? 'yes' : 'no');
    console.log('[nlm:pick] skip-refresh:', skipRefresh ? 'yes' : 'no');
    console.log('[nlm:pick] manual-select:', manualSelect ? 'yes' : 'no');
    console.log('[nlm:pick] query-set:', querySet);

    const result = spawnSync('node', cmdArgs, {
        cwd: ROOT,
        stdio: 'inherit',
        encoding: 'utf8',
    });
    process.exit(result.status || 0);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const readyEntries = readReadyRegistry();
    const readySet = new Set(readyEntries.map((entry) => entry.levelKey));

    let selectedLevels = [];
    if (args.only) {
        selectedLevels = filterReady(parseCsv(args.only), readySet);
    } else if (args.preset) {
        if (args.preset === 'all') {
            selectedLevels = readyEntries.map((entry) => entry.levelKey);
        } else if (PRESETS[args.preset]) {
            selectedLevels = filterReady(PRESETS[args.preset], readySet);
        }
    } else {
        selectedLevels = await pickSelectionInteractively(readyEntries);
    }

    if (selectedLevels.length === 0) {
        console.error('No valid ready levels selected, cancelled.');
        process.exit(1);
    }

    if (!args.only && !args.preset) {
        const chosen = await askImportOptionsInteractively({
            querySet: args.querySet,
        });
        args.querySet = chosen.querySet;
        args.manualSelect = chosen.manualSelect;
    }

    runBulkImport({
        queryPrefix: args.queryPrefix,
        dryRun: args.dryRun,
        skipRefresh: args.skipRefresh,
        selectedLevels,
        manualSelect: args.manualSelect,
        querySet: args.querySet,
    });
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
