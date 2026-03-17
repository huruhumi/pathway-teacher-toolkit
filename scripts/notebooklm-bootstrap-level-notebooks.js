const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'packages', 'shared', 'config', 'textbook-level-registry.json');
const DEFAULT_OUT_PATH = path.join(ROOT, 'scripts', 'notebooklm-level-map.generated.json');

function parseArgs(argv) {
    const args = {
        dryRun: false,
        force: false,
        only: null,
        prefix: 'Pathway Academy',
        out: DEFAULT_OUT_PATH,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--dry-run') args.dryRun = true;
        else if (token === '--force') args.force = true;
        else if (token === '--only') args.only = (argv[i + 1] || '').split(',').map((v) => v.trim()).filter(Boolean);
        else if (token === '--prefix') args.prefix = argv[i + 1] || args.prefix;
        else if (token === '--out') args.out = path.resolve(ROOT, argv[i + 1] || DEFAULT_OUT_PATH);

        if (['--only', '--prefix', '--out'].includes(token)) i += 1;
    }

    return args;
}

function runNotebookCreate(title) {
    const result = spawnSync('notebooklm', ['create', title, '--json'], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || 'Unknown notebooklm error').trim());
    }

    let parsed;
    try {
        parsed = JSON.parse((result.stdout || '').trim());
    } catch {
        throw new Error(`Unexpected create output: ${(result.stdout || '').trim()}`);
    }

    const notebookId = parsed?.id || parsed?.notebook?.id || parsed?.notebookId;
    if (!notebookId) {
        throw new Error(`Notebook ID missing in create output: ${(result.stdout || '').trim()}`);
    }

    return notebookId;
}

function listNotebookMapByTitle() {
    const result = spawnSync('notebooklm', ['list', '--json'], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || 'Unknown notebooklm error').trim());
    }

    let parsed;
    try {
        parsed = JSON.parse((result.stdout || '').trim());
    } catch {
        throw new Error(`Unexpected list output: ${(result.stdout || '').trim()}`);
    }

    const notebooks = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.notebooks) ? parsed.notebooks : []);

    const map = new Map();
    notebooks.forEach((item) => {
        const id = item?.id || item?.notebook_id || item?.notebookId;
        const title = (item?.title || '').trim();
        if (id && title && !map.has(title)) map.set(title, id);
    });
    return map;
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const onlySet = args.only ? new Set(args.only) : null;
    const selectedLevels = registry.filter((item) => {
        if (item.status === 'archived') return false;
        if (onlySet && !onlySet.has(item.levelKey)) return false;
        return true;
    });

    if (!selectedLevels.length) {
        console.log('No textbook levels matched the filter. Nothing to do.');
        return;
    }

    const mapping = {};
    const created = [];
    const skipped = [];
    const reusedByTitle = [];
    const failed = [];
    let existingNotebooksByTitle = new Map();

    try {
        existingNotebooksByTitle = listNotebookMapByTitle();
    } catch (error) {
        console.error(`Failed to list notebooks before bootstrap: ${error.message}`);
    }

    for (const level of selectedLevels) {
        if (!args.force && level.notebookId) {
            mapping[level.levelKey] = level.notebookId;
            skipped.push(level.levelKey);
            continue;
        }

        const title = `${args.prefix} | ${level.displayName} | Assessment KB`;
        if (!args.force && existingNotebooksByTitle.has(title)) {
            mapping[level.levelKey] = existingNotebooksByTitle.get(title);
            reusedByTitle.push(level.levelKey);
            continue;
        }

        if (args.dryRun) {
            mapping[level.levelKey] = '';
            created.push(`${level.levelKey} (dry-run)`);
            console.log(`[dry-run] notebooklm create "${title}" --json`);
            continue;
        }

        try {
            const notebookId = runNotebookCreate(title);
            mapping[level.levelKey] = notebookId;
            created.push(level.levelKey);
            existingNotebooksByTitle.set(title, notebookId);
            console.log(`Created notebook for ${level.levelKey}: ${notebookId}`);
        } catch (error) {
            failed.push(`${level.levelKey}: ${error.message}`);
            console.error(`Failed to create notebook for ${level.levelKey}: ${error.message}`);
        }
    }

    ensureDir(args.out);
    fs.writeFileSync(args.out, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');

    console.log('\nNotebook bootstrap summary');
    console.log(`- Selected: ${selectedLevels.length}`);
    console.log(`- Created: ${created.length}`);
    console.log(`- Skipped (existing notebookId): ${skipped.length}`);
    console.log(`- Reused by title: ${reusedByTitle.length}`);
    console.log(`- Failed: ${failed.length}`);
    console.log(`- Mapping file: ${args.out}`);

    if (failed.length > 0) {
        console.log('\nFailures');
        failed.forEach((line) => console.log(`- ${line}`));
        process.exitCode = 1;
    }
}

main();
