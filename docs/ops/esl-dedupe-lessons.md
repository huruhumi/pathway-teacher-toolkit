# ESL Lesson Kit Duplicate Cleanup

## What It Does
- Detects duplicate ESL lesson kit rows in `esl_lessons`.
- Uses strict matching:
  - same topic/level/curriculum link (`curriculum_id`, `unit_number`, `lesson_index`)
  - same normalized lesson content hash
  - created/updated within a short time window
- Keeps the newest row in each duplicate cluster and marks the others for deletion.

## Safety Defaults
- Default mode is **dry-run** (no deletion).
- `--apply` is required to actually delete rows.
- `--apply` also requires `--user-id`.
- Safety cap: `--max-delete` (default `500`).

## Prerequisites
Configure in `.env.local` or `.env`:
- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Commands
1. Dry-run (recommended first):
```powershell
npm run dedupe:esl-lessons -- --user-id <USER_UUID> --output docs/reports/esl-dedupe-lessons.json
```

2. Apply cleanup after review:
```powershell
npm run dedupe:esl-lessons -- --user-id <USER_UUID> --apply
```

3. Adjust window (example: 15 minutes):
```powershell
npm run dedupe:esl-lessons -- --user-id <USER_UUID> --window-minutes 15
```

## Optional Flags
- `--sample-limit <n>`: number of sample duplicate groups in report.
- `--max-delete <n>`: increase/delete cap only if you are sure.
- `--skip-index-cleanup`: keep `record_index` rows untouched.

## Suggested Flow
1. Run dry-run and inspect JSON report.
2. Confirm duplicate groups are expected.
3. Run with `--apply`.
4. Refresh ESL Records page and verify duplicates are gone.
