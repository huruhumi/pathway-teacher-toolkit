---
description: Export a Nature Compass lesson plan's handbook to NotebookLM as slide decks
---

# Export Handbook to NotebookLM

// turbo-all

This workflow reads a saved Nature Compass lesson plan from Supabase, creates a NotebookLM notebook, splits the handbook pages into 15-page chunks (NotebookLM's slide deck limit), uploads each chunk as a source, and generates a slide deck for each source.

## AUTOMATION RULES

> **ONLY ONE HUMAN CONFIRMATION**: Step 1 (choosing the lesson plan). Everything else runs fully automated — auth recovery, uploads, generation, polling, and reporting. Do NOT use `notify_user` except in Step 1 and the final report (Step 8). Handle all errors silently with retries.

## Prerequisites

- Supabase project ID: `mjvxaicypucfrrvollwm`
- The lesson plan must be saved to Supabase first (via the web app's Save button)

## Steps

### 1. Fetch and select lesson plan (ONLY human confirmation point)

```sql
SELECT id, name, updated_at
FROM lesson_plans
ORDER BY updated_at DESC
LIMIT 5;
```

Run via `mcp_supabase-mcp-server_execute_sql` with project_id `mjvxaicypucfrrvollwm`.

If the user specified a lesson plan name, filter by name and auto-select it — skip asking.
Otherwise, show the 5 most recent plans via `notify_user` and ask which one to export.

### 2. Ensure NotebookLM auth (AUTOMATED — no user interaction)

1. Call `mcp_notebooklm_refresh_auth` first.
2. Try `mcp_notebooklm_notebook_create` with a test title.
3. If auth fails:
   a. Kill any processes on port 9222: `Get-NetTCPConnection -LocalPort 9222 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`
   b. Run `notebooklm-mcp-auth` (SafeToAutoRun=true per turbo-all) and wait up to 60s.
   c. Call `mcp_notebooklm_refresh_auth` again.
   d. If still failing after 2 retries, THEN notify user with specific instructions.
4. Do NOT ask the user about auth unless all automated retries fail.

### 3. Extract handbook data

From the selected plan, fetch:

```sql
SELECT
  plan_data->'missionBriefing'->>'title' as title,
  plan_data->>'handbookStylePrompt' as style_prompt,
  jsonb_array_length(plan_data->'handbook') as page_count,
  plan_data->'handbook' as handbook
FROM lesson_plans
WHERE id = '[selected_id]';
```

### 4. Create NotebookLM notebook

Use `mcp_notebooklm_notebook_create` with title: `"[Lesson Name] — Handbook Slides"`

### 5. Split handbook into chunks and upload

Split the `handbook` array into groups of **15 pages** each.

For each chunk, format the source text as:

```
=== GLOBAL STYLE PROMPT ===
[handbookStylePrompt]

=== HANDBOOK PAGES [start]-[end] ===

--- Page [n]: [title] ([section]) ---
[Layout] [layoutDescription]
[Visual] [visualPrompt]
[Content] [contentPrompt]

(repeat for each page in chunk)
```

Upload each chunk via `mcp_notebooklm_notebook_add_text`:

- `title`: `"Handbook Pages [start]-[end]"`
- Wait 3 seconds between uploads (`Start-Sleep -Seconds 3`)

### 6. Generate slide decks (AUTOMATED)

For each source, call `mcp_notebooklm_slide_deck_create` with:

- `format`: `"detailed_deck"`
- `length`: `"default"`
- `language`: `"zh"` for Chinese plans, `"en"` for English plans (detect from content)
- `confirm`: `true`
- `focus_prompt` logic:

**Single chunk** (≤15 pages): `"[handbookStylePrompt]"`

**First chunk**: `"[handbookStylePrompt]. This is Part 1 of [N]. Include a title/cover slide at the beginning. Do NOT include an ending slide or back cover — the presentation continues in the next part."`

**Middle chunks**: `"[handbookStylePrompt]. This is Part [X] of [N]. Do NOT include a title/cover slide or ending slide — this is a continuation. Start directly with the content."`

**Last chunk**: `"[handbookStylePrompt]. This is Part [N] of [N] (final). Do NOT include a title/cover slide — this is a continuation from Part [N-1]. Include an ending/back cover slide."`

**Wait 30 seconds between slide deck generations** (`Start-Sleep -Seconds 30`).

### 7. Report results (END — do NOT poll for completion)

After all slide deck `create` calls return successfully, immediately use `notify_user` to report:

- Notebook name and clickable link
- Number of sources created
- Number of slide deck generation jobs queued
- Any failures during the process

**Do NOT poll `studio_status` for completion.** The user will check manually.

## Error Handling

- **Auth fails**: Auto-retry per Step 2. Only ask user after 2 automated retries fail.
- **Slide deck generation fails**: Log the error, continue with remaining chunks, report failures at the end.
- **Rate limited**: Wait 60 seconds and retry the failed operation automatically.
- **Port 9222 conflict**: Auto-kill blocking process and retry (Step 2a).
