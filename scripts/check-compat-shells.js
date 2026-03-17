const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.join(ROOT, 'apps');

const FILE_EXTS = new Set(['.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo']);

const STATIC_IMPORT_RE = /from\s+['"]([^'"]*geminiService)['"]/g;
const DYNAMIC_IMPORT_RE = /import\(\s*['"]([^'"]*geminiService)['"]\s*\)/g;

const LEGACY_SHELLS = [
  'apps/esl-planner/services/geminiService.ts',
  'apps/nature-compass/services/geminiService.ts',
  'apps/essay-lab/services/geminiService.ts',
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), acc);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!FILE_EXTS.has(ext)) continue;
    acc.push(path.join(dir, entry.name));
  }
  return acc;
}

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function collectLegacyImports(files) {
  const imports = [];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const normalizedFile = normalize(path.relative(ROOT, filePath));

    if (normalizedFile.endsWith('services/geminiService.ts')) continue;

    for (const re of [STATIC_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(source)) !== null) {
        imports.push({
          file: normalizedFile,
          specifier: match[1],
        });
      }
    }
  }

  return imports;
}

function collectExistingShells() {
  return LEGACY_SHELLS.filter((shell) => fs.existsSync(path.join(ROOT, shell)));
}

function main() {
  const files = walk(APPS_DIR);
  const imports = collectLegacyImports(files);
  const existingShells = collectExistingShells();

  console.log('[compat-shells] Checking legacy geminiService imports...');
  console.log(`[compat-shells] Scanned files: ${files.length}`);

  if (imports.length > 0) {
    console.error(`\n[compat-shells] Found ${imports.length} legacy import(s):`);
    for (const item of imports) {
      console.error(`- ${item.file} -> ${item.specifier}`);
    }
    process.exit(1);
  }

  console.log('\n[compat-shells] No legacy imports found in app code.');

  if (existingShells.length > 0) {
    console.error('\n[compat-shells] Legacy compatibility shell files still exist:');
    for (const shell of existingShells) {
      console.error(`- ${shell}`);
    }
    console.error('[compat-shells] Remove these files to finish shell sunset.');
    process.exit(1);
  }

  console.log('[compat-shells] No compatibility shell files found. Sunset complete.');
}

main();
