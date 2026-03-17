const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'packages', 'shared', 'config', 'textbook-level-registry.json');
const DEFAULT_MANIFEST_PATH = path.join(ROOT, 'scripts', 'notebooklm-drive-import.manifest.json');

function parseArgs(argv) {
    const args = {
        manifest: DEFAULT_MANIFEST_PATH,
        dryRun: false,
        skipRefresh: false,
        only: null,
        manualSelect: false,
        querySet: 'both',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--manifest') {
            args.manifest = path.resolve(ROOT, argv[i + 1] || DEFAULT_MANIFEST_PATH);
            i += 1;
        } else if (token === '--dry-run') {
            args.dryRun = true;
        } else if (token === '--skip-refresh') {
            args.skipRefresh = true;
        } else if (token === '--only') {
            args.only = (argv[i + 1] || '').split(',').map((v) => v.trim()).filter(Boolean);
            i += 1;
        } else if (token === '--manual-select') {
            args.manualSelect = true;
        } else if (token === '--query-set') {
            const value = (argv[i + 1] || 'both').trim().toLowerCase();
            args.querySet = ['both', 'assessment', 'materials'].includes(value) ? value : 'both';
            i += 1;
        }
    }

    return args;
}

function runNotebookLM(args, { allowFailure = false } = {}) {
    const cmdText = `notebooklm ${args.join(' ')}`;
    if (allowFailure) console.log(`[run] ${cmdText}`);

    const result = spawnSync('notebooklm', args, {
        cwd: ROOT,
        encoding: 'utf8',
    });

    if (result.status !== 0 && !allowFailure) {
        throw new Error((result.stderr || result.stdout || 'Unknown notebooklm error').trim());
    }

    return result;
}

function parseJsonOutput(raw) {
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw.trim());
}

function shouldImportQuery(queryItem, querySet) {
    if (querySet === 'both') return true;
    const q = (queryItem?.query || '').toLowerCase();
    if (!q) return false;
    const isAssessment = q.includes('assessment') || q.includes('rubric') || q.includes('teacher guide');
    const isMaterials = q.includes('unit objectives') || q.includes('vocabulary') || q.includes('grammar') || q.includes('worksheet');
    if (querySet === 'assessment') return isAssessment;
    if (querySet === 'materials') return isMaterials;
    return true;
}

function getSourceIdsForNotebook(notebookId) {
    const result = runNotebookLM(['source', 'list', '-n', notebookId, '--json']);
    const parsed = parseJsonOutput(result.stdout) || [];
    const sourceArray = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.sources)
            ? parsed.sources
            : [];

    return sourceArray
        .map((source) => source?.id || source?.source_id || source?.sourceId)
        .filter(Boolean);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(args.manifest)) {
        console.error(`Manifest not found: ${args.manifest}`);
        process.exit(1);
    }

    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
    const onlySet = args.only ? new Set(args.only) : null;
    const entries = (Array.isArray(manifest) ? manifest : []).filter((entry) => {
        if (!onlySet) return true;
        return onlySet.has(entry.levelKey);
    });

    if (!entries.length) {
        console.log('No manifest entries matched the filter. Nothing to import.');
        return;
    }

    const registryByLevel = new Map(registry.map((item) => [item.levelKey, item]));
    const failures = [];
    const warnings = [];

    for (const entry of entries) {
        const levelEntry = registryByLevel.get(entry.levelKey);
        if (!levelEntry) {
            const message = `${entry.levelKey}: level key not found in registry`;
            if (args.dryRun) warnings.push(message);
            else failures.push(message);
            continue;
        }
        if (!levelEntry.notebookId) {
            const message = `${entry.levelKey}: notebookId is empty in registry`;
            if (args.dryRun) warnings.push(message);
            else failures.push(message);
            continue;
        }

        const notebookId = levelEntry.notebookId;
        const driveSources = Array.isArray(entry.driveSources) ? entry.driveSources : [];
        const researchQueries = Array.isArray(entry.researchQueries) ? entry.researchQueries : [];

        console.log(`\nImporting for ${entry.levelKey} -> notebook ${notebookId}`);

        for (const source of driveSources) {
            const fileId = source.fileId;
            const title = source.title || fileId;
            const mimeType = source.mimeType || 'google-doc';
            if (!fileId) {
                failures.push(`${entry.levelKey}: drive source missing fileId`);
                continue;
            }

            const cmd = ['source', 'add-drive', fileId, title, '-n', notebookId, '--mime-type', mimeType];
            if (args.dryRun) {
                console.log(`[dry-run] notebooklm ${cmd.join(' ')}`);
            } else {
                try {
                    runNotebookLM(cmd);
                } catch (error) {
                    failures.push(`${entry.levelKey}: add-drive failed for ${fileId}: ${error.message}`);
                }
            }
        }

        for (const queryItem of researchQueries) {
            if (!shouldImportQuery(queryItem, args.querySet)) {
                continue;
            }
            const query = queryItem.query;
            if (!query) {
                failures.push(`${entry.levelKey}: research query missing query text`);
                continue;
            }

            const fromSource = queryItem.from || 'drive';
            const mode = queryItem.mode || 'fast';
            const importAll = args.manualSelect ? false : queryItem.importAll !== false;

            const cmd = ['source', 'add-research', query, '-n', notebookId, '--from', fromSource, '--mode', mode];
            if (importAll) cmd.push('--import-all');

            if (args.dryRun) {
                console.log(`[dry-run] notebooklm ${cmd.join(' ')}`);
            } else {
                try {
                    runNotebookLM(cmd);
                } catch (error) {
                    failures.push(`${entry.levelKey}: add-research failed for "${query}": ${error.message}`);
                }
            }
        }

        if (!args.skipRefresh) {
            if (args.dryRun) {
                console.log(`[dry-run] notebooklm source list -n ${notebookId} --json`);
                console.log(`[dry-run] notebooklm source refresh <source_id> -n ${notebookId}`);
            } else {
                try {
                    const sourceIds = getSourceIdsForNotebook(notebookId);
                    for (const sourceId of sourceIds) {
                        try {
                            runNotebookLM(['source', 'refresh', sourceId, '-n', notebookId]);
                        } catch (error) {
                            failures.push(`${entry.levelKey}: refresh failed for source ${sourceId}: ${error.message}`);
                        }
                    }
                } catch (error) {
                    failures.push(`${entry.levelKey}: failed to list sources for refresh: ${error.message}`);
                }
            }
        }
    }

    console.log('\nDrive import summary');
    console.log(`- Entries processed: ${entries.length}`);
    console.log(`- Dry-run: ${args.dryRun ? 'yes' : 'no'}`);
    console.log(`- Refresh skipped: ${args.skipRefresh ? 'yes' : 'no'}`);
    console.log(`- Manual select: ${args.manualSelect ? 'yes' : 'no'}`);
    console.log(`- Query set: ${args.querySet}`);
    console.log(`- Warnings: ${warnings.length}`);
    console.log(`- Failures: ${failures.length}`);

    if (warnings.length) {
        console.log('\nWarnings');
        warnings.forEach((line) => console.log(`- ${line}`));
    }

    if (failures.length) {
        console.log('\nFailures');
        failures.forEach((line) => console.log(`- ${line}`));
        process.exitCode = 1;
    }
}

main();
