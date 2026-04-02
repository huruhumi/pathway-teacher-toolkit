const fs = require('fs');
const path = require('path');
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
    from: '',
    dryRun: false,
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--user-id') {
      args.userId = argv[i + 1] || '';
      i += 1;
    } else if (token === '--from') {
      args.from = argv[i + 1] || '';
      i += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--apply') {
      args.apply = true;
    }
  }

  if (!args.dryRun && !args.apply) {
    args.dryRun = true;
  }
  if (args.dryRun && args.apply) {
    throw new Error('Use either --dry-run or --apply, not both.');
  }

  return args;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function fetchExistingIds(client, tableName, userId) {
  const pageSize = 1000;
  let offset = 0;
  const ids = new Set();

  while (true) {
    const { data, error } = await client
      .from(tableName)
      .select('id')
      .eq('user_id', userId)
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`${tableName} existing-id query failed: ${error.message}`);
    }

    const batch = data || [];
    for (const row of batch) {
      if (row?.id) ids.add(row.id);
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return ids;
}

async function upsertChunked(client, tableName, rows) {
  const chunkSize = 200;
  let affected = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error, count } = await client
      .from(tableName)
      .upsert(chunk, { onConflict: 'id', count: 'exact' });
    if (error) {
      throw new Error(`${tableName} upsert failed: ${error.message}`);
    }
    if (typeof count === 'number') affected += count;
  }
  return affected;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!args.userId) {
    console.error('[records:restore] Missing --user-id <USER_UUID>');
    process.exit(1);
  }
  if (!args.from) {
    console.error('[records:restore] Missing --from <BACKUP_DIR>');
    process.exit(1);
  }

  const backupDir = path.resolve(ROOT, args.from);
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`[records:restore] Missing manifest: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = readJsonFile(manifestPath);
  if (manifest.userId && manifest.userId !== args.userId) {
    console.error(`[records:restore] Backup user mismatch. manifest=${manifest.userId}, --user-id=${args.userId}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[records:restore] Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = {
    startedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    userId: args.userId,
    backupDir,
    tables: [],
  };

  for (const tableName of TABLES) {
    const manifestEntry = (manifest.tables || []).find((entry) => entry.table === tableName);
    const fileName = manifestEntry?.file || `${tableName}.json`;
    const filePath = path.join(backupDir, fileName);
    if (!fs.existsSync(filePath)) {
      report.tables.push({
        table: tableName,
        status: 'missing-file',
        file: fileName,
      });
      console.log(`[records:restore] ${tableName}: skipped (missing ${fileName})`);
      continue;
    }

    const rows = readJsonFile(filePath);
    if (!Array.isArray(rows)) {
      throw new Error(`${tableName} backup payload must be an array.`);
    }

    const normalizedRows = rows
      .filter((row) => row && typeof row === 'object' && row.id)
      .map((row) => ({ ...row, user_id: args.userId }));

    const existingIds = await fetchExistingIds(client, tableName, args.userId);
    let inserts = 0;
    let updates = 0;
    for (const row of normalizedRows) {
      if (existingIds.has(row.id)) updates += 1;
      else inserts += 1;
    }

    let affected = 0;
    if (args.apply && normalizedRows.length > 0) {
      affected = await upsertChunked(client, tableName, normalizedRows);
    }

    report.tables.push({
      table: tableName,
      rowsInBackup: normalizedRows.length,
      inserts,
      updates,
      affectedRows: affected,
      status: 'ok',
    });
    console.log(`[records:restore] ${tableName}: backup=${normalizedRows.length}, insert=${inserts}, update=${updates}${args.apply ? `, affected=${affected}` : ''}`);
  }

  report.completedAt = new Date().toISOString();
  const reportFile = `restore-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const reportPath = path.join(backupDir, reportFile);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[records:restore] Report written: ${reportPath}`);
  console.log(`[records:restore] Mode: ${report.mode}`);
}

main().catch((error) => {
  console.error('[records:restore] Failed:', error?.message || error);
  process.exit(1);
});
