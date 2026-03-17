const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
    dotenv.config({ path: path.join(ROOT, '.env.local') });
    dotenv.config({ path: path.join(ROOT, '.env') });
}

function parseArgs(argv) {
    const args = {
        userId: '',
        windowMinutes: 10,
        apply: false,
        sampleLimit: 30,
        maxDelete: 500,
        output: '',
        skipIndexCleanup: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--user-id') {
            args.userId = argv[i + 1] || '';
            i += 1;
        } else if (token === '--window-minutes') {
            const parsed = Number(argv[i + 1]);
            if (Number.isFinite(parsed) && parsed > 0) {
                args.windowMinutes = Math.floor(parsed);
            }
            i += 1;
        } else if (token === '--sample-limit') {
            const parsed = Number(argv[i + 1]);
            if (Number.isFinite(parsed) && parsed > 0) {
                args.sampleLimit = Math.floor(parsed);
            }
            i += 1;
        } else if (token === '--max-delete') {
            const parsed = Number(argv[i + 1]);
            if (Number.isFinite(parsed) && parsed > 0) {
                args.maxDelete = Math.floor(parsed);
            }
            i += 1;
        } else if (token === '--output') {
            args.output = path.resolve(ROOT, argv[i + 1] || '');
            i += 1;
        } else if (token === '--apply') {
            args.apply = true;
        } else if (token === '--skip-index-cleanup') {
            args.skipIndexCleanup = true;
        } else if (token === '--help' || token === '-h') {
            args.help = true;
        }
    }

    return args;
}

function printHelp() {
    console.log('ESL duplicate lessons cleanup');
    console.log('');
    console.log('Default mode is DRY RUN (no deletion).');
    console.log('');
    console.log('Usage:');
    console.log('  npm run dedupe:esl-lessons -- --user-id <USER_UUID>');
    console.log('  npm run dedupe:esl-lessons -- --user-id <USER_UUID> --window-minutes 15 --output docs/reports/esl-dedupe.json');
    console.log('  npm run dedupe:esl-lessons -- --user-id <USER_UUID> --apply');
    console.log('');
    console.log('Options:');
    console.log('  --user-id <id>           Target a single user. Required when using --apply.');
    console.log('  --window-minutes <n>     Time window for duplicate clustering. Default: 10');
    console.log('  --sample-limit <n>       Number of sample groups in output. Default: 30');
    console.log('  --max-delete <n>         Safety cap for apply mode. Default: 500');
    console.log('  --skip-index-cleanup     Do not delete matching rows in record_index');
    console.log('  --output <file>          Write full JSON report');
    console.log('  --apply                  Actually delete duplicates');
}

async function fetchAllRows(client, tableName, { select = '*', orderBy = 'updated_at', ascending = false, eq = [] } = {}) {
    const pageSize = 1000;
    let offset = 0;
    const rows = [];

    while (true) {
        let query = client
            .from(tableName)
            .select(select)
            .order(orderBy, { ascending })
            .range(offset, offset + pageSize - 1);

        for (const [column, value] of eq) {
            query = query.eq(column, value);
        }

        const { data, error } = await query;
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

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeJsonValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeJsonValue(item));
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        const output = {};
        for (const key of keys) {
            output[key] = normalizeJsonValue(value[key]);
        }
        return output;
    }
    return value;
}

function stableJson(value) {
    return JSON.stringify(normalizeJsonValue(value));
}

function buildLessonCoreForHash(content) {
    if (!content || typeof content !== 'object') return null;
    return {
        structuredLessonPlan: content.structuredLessonPlan || null,
        slides: content.slides || null,
        flashcards: content.flashcards || null,
        games: content.games || null,
        readingCompanion: content.readingCompanion || null,
        worksheets: content.worksheets || null,
        phonics: content.phonics || null,
        summary: content.summary || null,
        textbookLevelKey: content.textbookLevelKey || null,
        assessmentPackId: content.assessmentPackId || null,
        knowledgeNotebookId: content.knowledgeNotebookId || null,
        groundingStatus: content.groundingStatus || null,
        qualityGate: content.qualityGate || null,
        scoreReport: content.scoreReport || null,
    };
}

function hashLessonContent(content) {
    const core = buildLessonCoreForHash(content);
    const payload = stableJson(core);
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

function toMillis(row) {
    const raw = row.updated_at || row.created_at;
    const ms = Date.parse(raw || '');
    if (Number.isFinite(ms)) return ms;
    return 0;
}

function buildFingerprint(row) {
    const topic = normalizeText(row.name).toLowerCase();
    const level = normalizeText(row.level).toLowerCase();
    const curriculumId = row.curriculum_id || '~';
    const unit = row.unit_number == null ? '~' : String(row.unit_number);
    const lessonIndex = row.lesson_index == null ? '~' : String(row.lesson_index);
    const contentHash = hashLessonContent(row.content_data);
    return [topic, level, curriculumId, unit, lessonIndex, contentHash].join('|');
}

function clusterByTime(rows, windowMs) {
    if (rows.length <= 1) return [rows];
    const clusters = [];
    let current = [rows[0]];

    for (let i = 1; i < rows.length; i += 1) {
        const prev = current[current.length - 1];
        const next = rows[i];
        const gap = Math.abs(prev._ts - next._ts);
        if (gap <= windowMs) {
            current.push(next);
        } else {
            clusters.push(current);
            current = [next];
        }
    }
    clusters.push(current);
    return clusters;
}

function analyzeRows(rows, windowMinutes) {
    const windowMs = windowMinutes * 60 * 1000;
    const userBuckets = new Map();
    for (const row of rows) {
        const userId = row.user_id || 'unknown-user';
        if (!userBuckets.has(userId)) userBuckets.set(userId, []);
        userBuckets.get(userId).push({ ...row, _ts: toMillis(row) });
    }

    const duplicateGroups = [];
    const fingerprintCountByUser = {};

    for (const [userId, userRows] of userBuckets.entries()) {
        const byFingerprint = new Map();
        for (const row of userRows) {
            const fp = buildFingerprint(row);
            if (!byFingerprint.has(fp)) byFingerprint.set(fp, []);
            byFingerprint.get(fp).push(row);
        }
        fingerprintCountByUser[userId] = byFingerprint.size;

        for (const [fingerprint, bucket] of byFingerprint.entries()) {
            if (bucket.length <= 1) continue;
            const sorted = [...bucket].sort((a, b) => b._ts - a._ts);
            const clusters = clusterByTime(sorted, windowMs);
            for (const cluster of clusters) {
                if (cluster.length <= 1) continue;
                const keep = cluster[0];
                const duplicates = cluster.slice(1);
                duplicateGroups.push({
                    userId,
                    fingerprint,
                    keep: {
                        id: keep.id,
                        name: keep.name,
                        updatedAt: keep.updated_at,
                        curriculumId: keep.curriculum_id,
                        lessonIndex: keep.lesson_index,
                    },
                    duplicates: duplicates.map((item) => ({
                        id: item.id,
                        name: item.name,
                        updatedAt: item.updated_at,
                        curriculumId: item.curriculum_id,
                        lessonIndex: item.lesson_index,
                    })),
                    clusterSize: cluster.length,
                    windowMinutes,
                });
            }
        }
    }

    return {
        duplicateGroups,
        fingerprintCountByUser,
        userCount: userBuckets.size,
    };
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function applyDeletions(client, userId, ids, { skipIndexCleanup }) {
    const idChunks = chunkArray(ids, 100);
    let deletedLessonRows = 0;
    let deletedIndexRows = 0;

    for (const chunk of idChunks) {
        const { error: lessonErr } = await client
            .from('esl_lessons')
            .delete()
            .eq('user_id', userId)
            .in('id', chunk);

        if (lessonErr) {
            throw new Error(`esl_lessons delete failed: ${lessonErr.message}`);
        }
        deletedLessonRows += chunk.length;

        if (!skipIndexCleanup) {
            const { error: indexErr } = await client
                .from('record_index')
                .delete()
                .eq('owner_id', userId)
                .eq('app_id', 'esl-planner')
                .eq('record_type', 'lesson_kit')
                .in('record_id', chunk);
            if (indexErr) {
                throw new Error(`record_index delete failed: ${indexErr.message}`);
            }
            deletedIndexRows += chunk.length;
        }
    }

    return { deletedLessonRows, deletedIndexRows };
}

async function main() {
    loadEnv();
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        process.exit(0);
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('[dedupe:esl-lessons] Missing environment variables.');
        console.error('[dedupe:esl-lessons] Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
        process.exit(1);
    }

    if (args.apply && !args.userId) {
        console.error('[dedupe:esl-lessons] --apply requires --user-id for safety.');
        process.exit(1);
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const eq = args.userId ? [['user_id', args.userId]] : [];
    const rows = await fetchAllRows(client, 'esl_lessons', {
        select: 'id,user_id,name,level,curriculum_id,unit_number,lesson_index,content_data,created_at,updated_at',
        eq,
    });

    const analysis = analyzeRows(rows, args.windowMinutes);
    const duplicateIds = analysis.duplicateGroups.flatMap((group) => group.duplicates.map((item) => item.id));

    const report = {
        generatedAt: new Date().toISOString(),
        mode: args.apply ? 'apply' : 'dry-run',
        scope: {
            userId: args.userId || 'all-users',
            windowMinutes: args.windowMinutes,
            sampleLimit: args.sampleLimit,
            maxDelete: args.maxDelete,
            skipIndexCleanup: args.skipIndexCleanup,
        },
        counts: {
            scannedRows: rows.length,
            users: analysis.userCount,
            duplicateGroups: analysis.duplicateGroups.length,
            duplicateRows: duplicateIds.length,
        },
        samples: analysis.duplicateGroups.slice(0, args.sampleLimit),
        deleted: {
            lessonRows: 0,
            indexRows: 0,
        },
    };

    if (args.apply) {
        if (duplicateIds.length > args.maxDelete) {
            throw new Error(`Refusing to delete ${duplicateIds.length} rows (safety cap: ${args.maxDelete}). Increase --max-delete after review.`);
        }
        const result = await applyDeletions(client, args.userId, duplicateIds, {
            skipIndexCleanup: args.skipIndexCleanup,
        });
        report.deleted.lessonRows = result.deletedLessonRows;
        report.deleted.indexRows = result.deletedIndexRows;
    }

    console.log('ESL duplicate lessons summary');
    console.log(`- Mode: ${report.mode}`);
    console.log(`- Scope user: ${report.scope.userId}`);
    console.log(`- Scanned rows: ${report.counts.scannedRows}`);
    console.log(`- Duplicate groups: ${report.counts.duplicateGroups}`);
    console.log(`- Duplicate rows: ${report.counts.duplicateRows}`);
    if (args.apply) {
        console.log(`- Deleted lesson rows: ${report.deleted.lessonRows}`);
        console.log(`- Deleted index rows: ${report.deleted.indexRows}`);
    } else {
        console.log('- No rows deleted (dry-run).');
    }

    if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`- Report written: ${args.output}`);
    }
}

main().catch((error) => {
    console.error(`[dedupe:esl-lessons] ${error.message || error}`);
    process.exit(1);
});
