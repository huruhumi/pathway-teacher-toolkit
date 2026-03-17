---
description: Export a Nature Compass lesson plan's handbook to NotebookLM as slide decks
---

# Export Handbook to NotebookLM

// turbo-all

This workflow reads a saved Nature Compass lesson plan from Supabase, creates a NotebookLM notebook, uploads fact sheets (knowledge base) and handbook page chunks as sources, and generates a slide deck for each handbook source.

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

### 2. Ensure NotebookLM auth (AUTOMATED — smart fast-path)

**Step 2a — Fast-path auth check**: Call `mcp_notebooklm_notebook_list` with `max_results: 1`.

- If it returns successfully → auth is valid, **skip to Step 3**.
- If it returns an auth error → proceed to Step 2b.

**Step 2b — Fresh cookie extraction** (only if 2a failed):

1. **Primary method (browser subagent)**: Use `browser_subagent` to navigate to `https://notebooklm.google.com`, extract the `Cookie` header from network requests, then call `mcp_notebooklm_save_auth_tokens` with the cookie string.
2. **Fallback (manual)**: If browser subagent fails (timeout/connection reset), ask the user to paste cookies from Chrome DevTools (F12 → Network → batchexecute → Copy as cURL → extract Cookie header).
3. Do NOT use `notebooklm-mcp-auth` CLI or port 9222 — these are unreliable on Windows.
4. Do NOT use `mcp_notebooklm_refresh_auth` alone — disk cache is usually stale.

### 3. Extract handbook data, fact sheet, and structure plan

From the selected plan, fetch:

```sql
SELECT
  plan_data->'missionBriefing'->>'title' as title,
  plan_data->>'handbookStylePrompt' as style_prompt,
  plan_data->>'handbookStructurePlan' as structure_plan,
  jsonb_array_length(plan_data->'handbook') as page_count,
  plan_data->'handbook' as handbook,
  plan_data->'roadmap' as roadmap,
  plan_data->>'factSheet' as fact_sheet
FROM lesson_plans
WHERE id = '[selected_id]';
```

**Language detection**: If `title` contains Chinese characters (`/[\u4e00-\u9fff]/`), set `language = 'zh'`. Otherwise `language = 'en'`.

### 4. Create NotebookLM notebook

Use `mcp_notebooklm_notebook_create` with title: `"[Lesson Name] — Handbook Slides"`

### 5a. Upload fact sheet as source

If `fact_sheet` is not null/empty:

- **If `fact_sheet.length <= 50000`**: Upload as a single source.
  - `title`: `"知识底稿 / Fact Sheet: [Lesson Title]"`
  - `text`: the full `fact_sheet` string

- **If `fact_sheet.length > 50000`**: Split at sentence boundaries (`.`, `。`, `\n\n`) into chunks of ≤50000 chars each. Upload each chunk as a separate source:
  - `title`: `"知识底稿 Part [X]/[N]: [Lesson Title]"`

- Wait 3 seconds after each upload (`Start-Sleep -Seconds 3`)

If `fact_sheet` is null or empty, skip this step silently.

### 5b. Upload handbook structure plan as source

If `structure_plan` is not null/empty, upload as a source:

- `title`: `"Handbook Structure Plan"`
- `text`: the `structure_plan` string
- Wait 3 seconds after upload

If null/empty, skip silently.

### 5c. Split handbook into chunks and upload

Split the `handbook` array into the **fewest possible chunks**, each with a maximum of **15 pages**. Distribute pages evenly across chunks.

```
MAX_PER_CHUNK = 15
numChunks = ceil(totalPages / MAX_PER_CHUNK)
pagesPerChunk = ceil(totalPages / numChunks)
```

Example: 30 pages → 2 chunks of `15, 15`
Example: 42 pages → 3 chunks of `14, 14, 14`
Example: 20 pages → 2 chunks of `10, 10`
Example: 15 pages → 1 chunk of `15`

For each chunk, format the source text as:

```text
=== GLOBAL STYLE PROMPT ===
[handbookStylePrompt]

=== HANDBOOK PAGES [start]-[end] ===

--- Page [n]: [title] ---
Section: [section]
Page Type: [pageType] (e.g. Cover, Content, Activity, Quiz, Certificate, Back Cover)

📖 Content:
[contentPrompt — the full educational text/activity instructions]

🎨 Visual Design:
[visualPrompt — description of illustrations and layout]

📐 Layout:
[layoutDescription — how elements are arranged on the page]

(repeat for each page in chunk)
```

> **KEY**: Upload the FULL `contentPrompt` text for each page — this is the primary educational content that NotebookLM will transform into slides. Do NOT truncate or summarize.

Upload each chunk via `mcp_notebooklm_notebook_add_text`:

- `title`: `"Handbook Pages [start]-[end]"`
- Wait 3 seconds between uploads (`Start-Sleep -Seconds 3`)

### 5d. Upload roadmap as source (for teacher slides)

Format the `roadmap` array as a text source:

```text
=== 教学路线图 / Teaching Roadmap ===

--- Phase [i+1]: [phase] ---
Time: [timeRange]
Activity: [activity]
Type: [activityType]
Location: [location]
Objective: [learningObjective]
Description: [description]

📋 Steps:
1. [step1]
2. [step2]
...

📚 Background Info:
- [backgroundInfo items]

💡 Teaching Tips:
- [teachingTips items]

📝 Activity Instructions:
[activityInstructions]

(repeat for each phase)
```

Upload via `mcp_notebooklm_notebook_add_text`:

- `title`: `"教学路线图 / Teaching Roadmap"`
- Wait 3 seconds after upload

> **Track source IDs**: Keep `handbook_source_ids` and `roadmap_source_id` separate — they are used for different slide decks.

### 6a. Generate student slide decks (handbook-based)

For each **handbook source** (NOT fact sheet, structure plan, or roadmap sources), call `mcp_notebooklm_slide_deck_create` with:

- `source_ids`: Only the handbook chunk source IDs
- `format`: `"detailed_deck"`
- `length`: `"default"`
- `language`: Use the `language` detected in Step 3
- `confirm`: `true`
- `focus_prompt` logic:

**Base instruction** (always prepended): `"IMPORTANT: Preserve ALL details from every page. Include all activity steps, vocabulary items, safety rules, learning objectives, quiz questions, and educational content. Do NOT summarize or omit any information. Each page should become at least 1-2 detailed slides."`

**Single chunk** (≤15 pages): `"[base instruction] [handbookStylePrompt]"`

**First chunk**: `"[base instruction] [handbookStylePrompt]. This is Part 1 of [N]. Include a title/cover slide at the beginning. Do NOT include an ending slide or back cover — the presentation continues in the next part."`

**Middle chunks**: `"[base instruction] [handbookStylePrompt]. This is Part [X] of [N]. Do NOT include a title/cover slide or ending slide — this is a continuation. Start directly with the content."`

**Last chunk**: `"[base instruction] [handbookStylePrompt]. This is Part [N] of [N] (final). Do NOT include a title/cover slide — this is a continuation from Part [N-1]. Include an ending/back cover slide."`

**Wait 30 seconds between slide deck generations** (`Start-Sleep -Seconds 30`).

**Retry logic**: If a slide deck generation fails, wait 60 seconds and retry. Maximum 2 retries per chunk. If still failing after retries, log the error and continue with remaining chunks.

### 6b. Generate teacher/parent slide deck (roadmap-based)

After all student slide decks are queued, generate the teacher version:

Call `mcp_notebooklm_slide_deck_create` with:

- `source_ids`: Only the **roadmap source ID** (NOT handbook chunks)
- `format`: `"detailed_deck"`
- `length`: `"default"`
- `language`: Use the `language` detected in Step 3
- `confirm`: `true`
- `focus_prompt`: `"Generate a comprehensive TEACHER/PARENT GUIDE presentation. For each teaching phase, include: 1) Background knowledge expanded from the fact sheet 2) Step-by-step teaching instructions 3) Suggested dialogue and questions to ask students 4) Safety notes and classroom management tips 5) Learning objectives and assessment criteria. This is a guide for the adult leading the activity, NOT for students. Use a professional but warm tone."`

> Note: Fact sheet is in the notebook as background context — NLM will automatically reference it when generating teacher slides from the roadmap.

### 7. Report results (END — do NOT poll for completion)

After all slide deck `create` calls return successfully, immediately use `notify_user` to report:

- Notebook name and **clickable link**: `https://notebooklm.google.com/notebook/{notebookId}`
- Number of fact sheet sources uploaded
- Number of handbook sources created
- Number of slide deck generation jobs queued
- Any failures during the process (including retried and ultimately failed chunks)

**Do NOT poll `studio_status` for completion.** The user will check manually.

## Error Handling

- **Auth fails (Step 2a)**: Fall through to Step 2b (browser subagent). If that also fails, ask user for cookies manually.
- **Slide deck generation fails**: Wait 60s → retry (max 2 retries). If still failing, log error, continue with remaining chunks, report failures at the end.
- **Rate limited (429)**: Wait 60 seconds and retry automatically.
- **Source upload fails**: Wait 5s → retry once. If still failing, skip and report.
