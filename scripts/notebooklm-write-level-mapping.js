const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'packages', 'shared', 'config', 'textbook-level-registry.json');
const DEFAULT_MAPPING_PATH = path.join(ROOT, 'scripts', 'notebooklm-level-map.generated.json');

function parseArgs(argv) {
    const args = {
        mapping: DEFAULT_MAPPING_PATH,
        markReady: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--mapping') {
            args.mapping = path.resolve(ROOT, argv[i + 1] || DEFAULT_MAPPING_PATH);
            i += 1;
        } else if (token === '--mark-ready') {
            args.markReady = true;
        }
    }

    return args;
}

function toMappingObject(raw) {
    if (!raw) return {};
    if (Array.isArray(raw)) {
        return raw.reduce((acc, item) => {
            if (item?.levelKey && item?.notebookId) acc[item.levelKey] = item.notebookId;
            return acc;
        }, {});
    }
    if (typeof raw === 'object') return raw;
    return {};
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(args.mapping)) {
        console.error(`Mapping file not found: ${args.mapping}`);
        process.exit(1);
    }

    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const rawMapping = JSON.parse(fs.readFileSync(args.mapping, 'utf8'));
    const mapping = toMappingObject(rawMapping);

    const keys = Object.keys(mapping);
    if (!keys.length) {
        console.error(`No mapping entries found in: ${args.mapping}`);
        process.exit(1);
    }

    const registryKeySet = new Set(registry.map((item) => item.levelKey));
    const missingKeys = keys.filter((key) => !registryKeySet.has(key));
    const updatedRegistry = registry.map((item) => {
        const notebookId = mapping[item.levelKey];
        if (!notebookId) return item;

        return {
            ...item,
            notebookId,
            ...(args.markReady ? { status: 'ready' } : {}),
        };
    });

    fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(updatedRegistry, null, 2)}\n`, 'utf8');

    const updatedCount = updatedRegistry.filter((item) => mapping[item.levelKey]).length;
    console.log('Textbook level mapping update summary');
    console.log(`- Mapping entries: ${keys.length}`);
    console.log(`- Updated registry entries: ${updatedCount}`);
    console.log(`- Marked ready: ${args.markReady ? 'yes' : 'no'}`);
    console.log(`- Registry path: ${REGISTRY_PATH}`);

    if (missingKeys.length) {
        console.log('- Unknown level keys in mapping:');
        missingKeys.forEach((key) => console.log(`  - ${key}`));
        process.exitCode = 1;
    }
}

main();
