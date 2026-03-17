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
        output: '',
        sampleLimit: 20,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--user-id') {
            args.userId = argv[i + 1] || '';
            i += 1;
        } else if (token === '--output') {
            args.output = path.resolve(ROOT, argv[i + 1] || '');
            i += 1;
        } else if (token === '--sample-limit') {
            const parsed = Number(argv[i + 1]);
            args.sampleLimit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20;
            i += 1;
        }
    }

    return args;
}

async function fetchAllRows(client, tableName, {
    select = '*',
    orderBy = 'updated_at',
    ascending = false,
    eq = [],
} = {}) {
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

function pushSample(list, value, limit) {
    if (list.length < limit) list.push(value);
}

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function assessLessonRows(lessonRows, indexMap, sampleLimit) {
    const issues = {
        missingContentData: [],
        missingStructuredPlan: [],
        missingClassInfo: [],
        metaFieldMismatch: [],
        missingIndexEntry: [],
        indexTitleMismatch: [],
    };

    for (const row of lessonRows) {
        const content = row.content_data;
        const meta = content && typeof content === 'object' ? content.__recordMeta : null;
        const indexKey = `${row.user_id}:${row.id}`;
        const idx = indexMap.get(indexKey);

        if (!content || typeof content !== 'object') {
            pushSample(issues.missingContentData, row.id, sampleLimit);
        }
        if (!content?.structuredLessonPlan) {
            pushSample(issues.missingStructuredPlan, row.id, sampleLimit);
        }
        if (!content?.structuredLessonPlan?.classInformation) {
            pushSample(issues.missingClassInfo, row.id, sampleLimit);
        }

        const metaCurriculumId = meta?.curriculumId ?? null;
        const metaUnitNumber = meta?.unitNumber ?? null;
        const metaLessonIndex = meta?.lessonIndex ?? null;
        const rowCurriculumId = row.curriculum_id ?? null;
        const rowUnitNumber = row.unit_number ?? null;
        const rowLessonIndex = row.lesson_index ?? null;

        if (
            meta
            && (
                metaCurriculumId !== rowCurriculumId
                || metaUnitNumber !== rowUnitNumber
                || metaLessonIndex !== rowLessonIndex
            )
        ) {
            pushSample(issues.metaFieldMismatch, row.id, sampleLimit);
        }

        if (!idx) {
            pushSample(issues.missingIndexEntry, row.id, sampleLimit);
        } else {
            const expectedTitle = normalizeText(row.name) || 'Untitled Lesson';
            const actualTitle = normalizeText(idx.title);
            if (expectedTitle && actualTitle && expectedTitle !== actualTitle) {
                pushSample(issues.indexTitleMismatch, row.id, sampleLimit);
            }
        }
    }

    return issues;
}

function assessCurriculumRows(curriculumRows, indexMap, sampleLimit) {
    const issues = {
        missingCurriculumData: [],
        missingParamsData: [],
        missingTextbookLevelKey: [],
        missingIndexEntry: [],
        indexTitleMismatch: [],
    };

    for (const row of curriculumRows) {
        const curriculum = row.curriculum_data;
        const params = row.params_data;
        const indexKey = `${row.user_id}:${row.id}`;
        const idx = indexMap.get(indexKey);

        if (!curriculum || typeof curriculum !== 'object') {
            pushSample(issues.missingCurriculumData, row.id, sampleLimit);
        }
        if (!params || typeof params !== 'object') {
            pushSample(issues.missingParamsData, row.id, sampleLimit);
        }
        if (!normalizeText(params?.textbookLevelKey)) {
            pushSample(issues.missingTextbookLevelKey, row.id, sampleLimit);
        }

        if (!idx) {
            pushSample(issues.missingIndexEntry, row.id, sampleLimit);
        } else {
            const expectedTitle = normalizeText(row.name) || 'Untitled Curriculum';
            const actualTitle = normalizeText(idx.title);
            if (expectedTitle && actualTitle && expectedTitle !== actualTitle) {
                pushSample(issues.indexTitleMismatch, row.id, sampleLimit);
            }
        }
    }

    return issues;
}

function countIssueTotal(issueMap) {
    return Object.values(issueMap).reduce((sum, ids) => sum + ids.length, 0);
}

function buildSummary(report) {
    const lessonIssueCount = countIssueTotal(report.lessons.issues);
    const curriculumIssueCount = countIssueTotal(report.curricula.issues);
    const criticalIssueCount = report.lessons.issues.missingIndexEntry.length + report.curricula.issues.missingIndexEntry.length;
    return {
        ok: criticalIssueCount === 0,
        criticalIssueCount,
        lessonIssueCount,
        curriculumIssueCount,
    };
}

async function main() {
    loadEnv();
    const args = parseArgs(process.argv.slice(2));

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('[audit:esl-storage] Missing environment variables.');
        console.error('[audit:esl-storage] Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
        process.exit(1);
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const eqOwner = args.userId ? [['user_id', args.userId]] : [];
    const lessonRows = await fetchAllRows(client, 'esl_lessons', { eq: eqOwner });
    const curriculumRows = await fetchAllRows(client, 'esl_curricula', { eq: eqOwner });

    let indexQuery = client
        .from('record_index')
        .select('record_id, owner_id, app_id, record_type, title, quality_status, updated_at')
        .eq('app_id', 'esl-planner');
    if (args.userId) {
        indexQuery = indexQuery.eq('owner_id', args.userId);
    }
    const { data: indexRows, error: indexError } = await indexQuery;
    if (indexError) {
        throw new Error(`record_index query failed: ${indexError.message}`);
    }

    const lessonIndexMap = new Map();
    const curriculumIndexMap = new Map();
    for (const row of (indexRows || [])) {
        const key = `${row.owner_id}:${row.record_id}`;
        if (row.record_type === 'lesson_kit') lessonIndexMap.set(key, row);
        if (row.record_type === 'curriculum') curriculumIndexMap.set(key, row);
    }

    const report = {
        generatedAt: new Date().toISOString(),
        scope: {
            userId: args.userId || 'all-users',
            sampleLimit: args.sampleLimit,
        },
        counts: {
            lessons: lessonRows.length,
            curricula: curriculumRows.length,
            lessonIndexRows: lessonIndexMap.size,
            curriculumIndexRows: curriculumIndexMap.size,
        },
        lessons: {
            issues: assessLessonRows(lessonRows, lessonIndexMap, args.sampleLimit),
        },
        curricula: {
            issues: assessCurriculumRows(curriculumRows, curriculumIndexMap, args.sampleLimit),
        },
    };
    report.summary = buildSummary(report);

    console.log('ESL storage alignment audit summary');
    console.log(`- Scope user: ${report.scope.userId}`);
    console.log(`- Lessons rows: ${report.counts.lessons}`);
    console.log(`- Curricula rows: ${report.counts.curricula}`);
    console.log(`- Lesson index rows: ${report.counts.lessonIndexRows}`);
    console.log(`- Curriculum index rows: ${report.counts.curriculumIndexRows}`);
    console.log(`- Critical issues: ${report.summary.criticalIssueCount}`);
    console.log(`- Lesson sampled issues: ${report.summary.lessonIssueCount}`);
    console.log(`- Curriculum sampled issues: ${report.summary.curriculumIssueCount}`);
    console.log(`- Overall: ${report.summary.ok ? 'PASS' : 'REVIEW_REQUIRED'}`);

    if (args.output) {
        fs.mkdirSync(path.dirname(args.output), { recursive: true });
        fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`- Report written: ${args.output}`);
    }
}

main().catch((error) => {
    console.error(`[audit:esl-storage] ${error.message || error}`);
    process.exit(1);
});
