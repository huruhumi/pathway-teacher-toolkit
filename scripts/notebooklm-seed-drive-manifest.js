const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'packages', 'shared', 'config', 'textbook-level-registry.json');
const MANIFEST_PATH = path.join(ROOT, 'scripts', 'notebooklm-drive-import.manifest.json');

function parseArgs(argv) {
    const args = {
        out: MANIFEST_PATH,
        includeArchived: false,
        withFileIds: false,
        queryPrefix: '',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--out') {
            args.out = path.resolve(ROOT, argv[i + 1] || MANIFEST_PATH);
            i += 1;
        } else if (token === '--include-archived') {
            args.includeArchived = true;
        } else if (token === '--with-fileids-placeholders') {
            args.withFileIds = true;
        } else if (token === '--query-prefix') {
            args.queryPrefix = (argv[i + 1] || '').trim();
            i += 1;
        }
    }
    return args;
}

function inferTextbook(displayName = '') {
    const s = displayName.toLowerCase();
    if (s.includes('trailblazer')) return 'Trailblazer';
    if (s.includes('reflect')) return 'Reflect';
    if (s.includes('pathways')) return 'Pathways';
    return 'Textbook';
}

function inferVolume(displayName = '') {
    const base = displayName.replace(/\([^)]*\)/g, '').trim();
    const parts = base.split(/\s+/);
    if (parts.length <= 1) return base;
    return parts.slice(1).join(' ');
}

function buildResearchQueries(textbook, volume, cefrLabel, queryPrefix = '') {
    const safeVolume = volume || 'core';
    const safeCefr = cefrLabel || '';
    const prefix = queryPrefix ? `${queryPrefix} ` : '';
    return [
        {
            query: `${prefix}${textbook} ${safeVolume} teacher guide assessment rubric ${safeCefr} pdf doc`,
            from: 'drive',
            mode: 'fast',
            importAll: true,
        },
        {
            query: `${prefix}${textbook} ${safeVolume} unit objectives vocabulary grammar worksheet`,
            from: 'drive',
            mode: 'fast',
            importAll: true,
        },
    ];
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const selected = registry.filter((item) => args.includeArchived || item.status !== 'archived');

    const manifest = selected.map((item) => {
        const textbook = inferTextbook(item.displayName);
        const volume = inferVolume(item.displayName);
        const cefr = (item.displayName.match(/\(([^)]+)\)/)?.[1] || '').trim();
        const driveSources = args.withFileIds
            ? [
                {
                    fileId: 'REPLACE_WITH_DRIVE_FILE_ID',
                    title: `${item.displayName} Core Source`,
                    mimeType: 'google-doc',
                },
            ]
            : [];

        return {
            levelKey: item.levelKey,
            driveSources,
            researchQueries: buildResearchQueries(textbook, volume, cefr, args.queryPrefix),
        };
    });

    fs.writeFileSync(args.out, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Seeded manifest with ${manifest.length} entries: ${args.out}`);
}

main();
