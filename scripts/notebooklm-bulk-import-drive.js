const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'scripts', 'notebooklm-drive-import.manifest.auto.json');

function parseArgs(argv) {
    const args = {
        manifestOut: DEFAULT_MANIFEST_PATH,
        only: '',
        skipRefresh: false,
        dryRun: false,
        includeArchived: false,
        queryPrefix: '',
        manualSelect: false,
        querySet: 'both',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--manifest-out') {
            args.manifestOut = path.resolve(ROOT, argv[i + 1] || DEFAULT_MANIFEST_PATH);
            i += 1;
        } else if (token === '--only') {
            args.only = (argv[i + 1] || '').trim();
            i += 1;
        } else if (token === '--skip-refresh') {
            args.skipRefresh = true;
        } else if (token === '--dry-run') {
            args.dryRun = true;
        } else if (token === '--include-archived') {
            args.includeArchived = true;
        } else if (token === '--query-prefix') {
            args.queryPrefix = (argv[i + 1] || '').trim();
            i += 1;
        } else if (token === '--manual-select') {
            args.manualSelect = true;
        } else if (token === '--import-all') {
            args.manualSelect = false;
        } else if (token === '--query-set') {
            const value = (argv[i + 1] || 'both').trim().toLowerCase();
            args.querySet = ['both', 'assessment', 'materials'].includes(value) ? value : 'both';
            i += 1;
        }
    }

    return args;
}

function runNodeScript(label, scriptPath, scriptArgs) {
    const cmdPreview = `node ${scriptPath} ${scriptArgs.join(' ')}`.trim();
    console.log(`\n[step] ${label}`);
    console.log(`[cmd] ${cmdPreview}`);

    const result = spawnSync('node', [scriptPath, ...scriptArgs], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'inherit',
    });

    if (result.status !== 0) {
        throw new Error(`${label} failed with exit code ${result.status}`);
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    const seedArgs = ['scripts/notebooklm-seed-drive-manifest.js', '--out', args.manifestOut];
    if (args.includeArchived) seedArgs.push('--include-archived');
    if (args.queryPrefix) seedArgs.push('--query-prefix', args.queryPrefix);
    runNodeScript('Generate drive import manifest automatically', seedArgs[0], seedArgs.slice(1));

    const importArgs = ['scripts/notebooklm-import-drive-sources.js', '--manifest', args.manifestOut];
    if (args.only) importArgs.push('--only', args.only);
    if (args.skipRefresh) importArgs.push('--skip-refresh');
    if (args.dryRun) importArgs.push('--dry-run');
    if (args.manualSelect) importArgs.push('--manual-select');
    if (args.querySet) importArgs.push('--query-set', args.querySet);
    runNodeScript('Import NotebookLM sources in batch', importArgs[0], importArgs.slice(1));

    console.log('\n[done] Bulk Drive import completed.');
}

main();
