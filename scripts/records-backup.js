const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const TABLES = ['esl_lessons', 'esl_curricula', 'lesson_plans', 'curricula', 'essay_records'];

function loadEnv() {
  dotenv.config({ path: path.join(ROOT, '.env.local') });
  dotenv.config({ path: path.join(ROOT, '.env') });
}

function parseArgs(argv) {
  const args = {
    userId: '',
    out: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--user-id') {
      args.userId = argv[i + 1] || '';
      i += 1;
    } else if (token === '--out') {
      args.out = argv[i + 1] || '';
      i += 1;
    }
  }

  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function stableJson(value) {
  return JSON.stringify(value, null, 2);
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function fetchAllRows(client, tableName, userId) {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];

  while (true) {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`${tableName} query failed: ${error.message}`);
    }

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!args.userId) {
    console.error('[records:backup] Missing --user-id <USER_UUID>');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(ROOT, args.out || path.join('backups', 'records', timestamp));
  ensureDir(outDir);

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[records:backup] Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    userId: args.userId,
    outDir,
    tables: [],
  };

  for (const tableName of TABLES) {
    const rows = await fetchAllRows(client, tableName, args.userId);
    const fileName = `${tableName}.json`;
    const filePath = path.join(outDir, fileName);
    const payload = stableJson(rows);
    fs.writeFileSync(filePath, payload, 'utf8');

    manifest.tables.push({
      table: tableName,
      file: fileName,
      rows: rows.length,
      sha256: sha256(payload),
    });

    console.log(`[records:backup] ${tableName}: ${rows.length} rows`);
  }

  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, stableJson(manifest), 'utf8');
  console.log(`[records:backup] Manifest written: ${manifestPath}`);
  console.log(`[records:backup] Done. Backup dir: ${outDir}`);
}

main().catch((error) => {
  console.error('[records:backup] Failed:', error?.message || error);
  process.exit(1);
});
