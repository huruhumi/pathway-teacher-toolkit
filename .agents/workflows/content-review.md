---
description: Nature Compass content quality review — generate curricula and lesson kits across age groups, review from multiple perspectives, output improvement report
---

# Content Review Workflow v3

// turbo-all

Automated content quality review for Nature Compass. Generates curricula + lesson kits, reviews from multiple expert perspectives, and produces a consolidated improvement report with automated quality checks. ALL output as markdown — no web UI.

## AUTOMATION RULES

> **ZERO human interaction** during Steps 0-8. The entire workflow runs unattended.
> Only the final report (Step 9) uses `notify_user`.
> All generated content goes to `apps/nature-compass/.content-review/[timestamp]/`.
> Track ALL errors encountered during execution — they become part of the final report.

## Config

```
THEME: "城市湿地生态探索" (pick one that covers biology, ecology, engineering)
CITY: "武汉"
LESSON_COUNT: 4
DURATION: "180 minutes"
AGE_GROUPS: ["6-8"]
MODES: ["school", "family-esl", "family-pure"]
  # school        → EN streaming route (generateLessonPlanStreaming)
  # family-esl    → EN streaming route + familyEslEnabled=true (parent-guided ESL moments)
  # family-pure   → CN streaming route (generateLessonPlanStreamingCN), no ESL
TARGET_HANDBOOK_PAGES: 15
REVIEW_DIR: apps/nature-compass/.content-review/[YYYYMMDD-HHmm]/
```

## Steps

### Step 0: Baseline Snapshot (optional)

If this is a "before vs after" comparison run:

1. Check if a previous review exists in `.content-review/` (look for the most recent `07-final-report/content-review-report.md`)
2. If found, copy its scores summary to `00-baseline/baseline-scores.md`
3. At the end (Step 9), generate a comparison table showing score deltas

If no previous run exists, skip this step and mark it as "First run — no baseline".

### Step 1: Setup

Create directory structure:

```
[REVIEW_DIR]/
├── 00-baseline/           # Step 0
├── 01-curricula/          # Step 2
├── 02-curriculum-review/  # Step 3
├── 03-curriculum-fixes/   # Step 4
├── 04-lesson-kits/        # Step 5
├── 05-kit-review/         # Step 6
├── 06-kit-fixes/          # Step 7
├── 07-final-report/       # Step 8
└── _errors.log            # Error log
```

Initialize `_errors.log` with timestamp header.
Initialize `_timing.log` to track API call durations.

### Step 2: Generate Curricula

For EACH age group × 2 languages = 2 curricula total.

Use a single Node.js `.mjs` script placed in `.content-review/` directory (for module resolution).
Call Gemini API directly with the same prompt logic as `curriculumService.ts`.

Output: `01-curricula/curriculum-[age]-[lang].json` + `.md`

**Track**: response time per call, write to `_timing.log`.

### Step 3: Review Curricula

For EACH curriculum (2 total), use Gemini to review from TWO perspectives:

1. **ESL Teacher** (EN only) / **STEAM Terminology Expert** (ZH)
2. **Activity Planner / 研学设计师**

Each review MUST produce a numeric score [1-10] per perspective.

Output: `02-curriculum-review/review-[age]-[lang].md`

### Step 4: Curriculum Optimization

Synthesize all 2 reviews into one optimization plan.

Output: `03-curriculum-fixes/optimization-plan.md`

### Step 5: Generate Lesson Kits (OPTIMIZED)

**KEY CHANGE**: Generate 3 kits total:

- For the age group, **randomly pick 1 lesson** from the 4-lesson curriculum
- Generate **school** + **family-esl** + **family-pure** for that lesson
- Total: 1 age group × 3 modes = **3 kits**

Mode → route mapping:

| Mode | `familyEslEnabled` | Streaming fn | Language |
|------|-------------------|--------------|----------|
| `school` | N/A | `generateLessonPlanStreaming` | EN |
| `family-esl` | `true` | `generateLessonPlanStreaming` | EN |
| `family-pure` | `false` | `generateLessonPlanStreamingCN` | ZH |

Each kit generates a full lesson plan with:

- **Step 5a: Fact Sheet** — call `generateFactSheet(input)` first (uses Google Search grounding). Attach result to input as `factSheet`. This mirrors the production `LessonKitPage` behavior.
- Mission Briefing, Vocabulary, Roadmap (5-7 phases), Supplies, Safety
- Handbook (TARGET_HANDBOOK_PAGES pages)

**CRITICAL (A11)**: Use the FULL PRODUCTION system prompt from `geminiService.ts`. Do NOT use a simplified prompt — review results must reflect actual production quality. **Execute these generations SEQUENTIALLY (one by one, awaiting each) to prevent Gemini API rate limits and timeouts.**

Output: `04-lesson-kits/lesson-[N]-[mode]-[age].json` + `.md`

**Track**: response time, write to `_timing.log`.

### Step 5b: Generate Structured Handbook Kit

Test the **structured handbook mode** (`structuredHandbookService.ts`) separately:

1. Pick 1 lesson from any curriculum
2. Create a simple 8-page custom structure outline (mix of Reading, Activity, Worksheet, Quiz pages)
3. Call `extractResearchTopics()` → `batchResearch()` → `generateStructuredPlan()` → `generateStructuredHandbook()`
4. Save result alongside regular kits

Output: `04-lesson-kits/lesson-structured-[age].json` + `.md`

### Step 6: Review Lesson Kits + Automated Checks

TWO parts: AI review + automated validation.

#### Part A: AI Review (7 perspectives)

For EACH kit (3 regular + 1 structured = 4 total), review from:

1. **ESL Teacher** — vocabulary vs CEFR, scaffolding quality
2. **Activity Planner** — 5E compliance, time realism, cross-curricular depth
3. **Parent** (family mode only) — clarity, equipment realism, fun factor
4. **Student/Child** (age-specific) — handbook readability, engagement, interaction balance
5. **UI Designer** — visualPrompt specificity, layoutDescription clarity, visual-text balance
6. **Operability Assessor / 可操作性评审** — Can a real teacher/parent actually execute this plan? Check: Are activity steps specific enough to follow without guessing? Are material quantities and sizes specified? Are time allocations realistic for each step? Are transitions between phases clear? Are contingency plans provided for common issues (weather, missing materials, low engagement)?
7. **Knowledge Accuracy Reviewer / 知识准确性评审** — Are the scientific/ecological/biological facts correct? Cross-check: species names, habitat descriptions, ecological relationships, STEAM concepts, safety claims. Flag any hallucinated facts, outdated information, or region-inappropriate examples (e.g., species not found near the specified city).
8. **Parent English Accessibility / 家长英文可及性评审** (family-esl mode only) — Is the English content simple enough for a Chinese parent with limited English? Check: Are English words/phrases ≤4 words? Is Chinese translation provided for every English term? Does English occupy ≤10% of activity time? Are there any sentences that require conversational English fluency to deliver? Is the tone "fun discovery" rather than "language lesson"?

Each perspective gives a score [1-10].

#### Part B: Automated Validation (NO AI needed — pure code)

Run these checks programmatically on the generated JSON:

**B1. Handbook Page Count**

```
CHECK: handbook.length === TARGET_HANDBOOK_PAGES
RESULT: PASS/FAIL + actual count
```

**B2. Reading Page Word Count by Age (EN = ESL, ZH = Native)**

```
For each handbook page where section === 'Reading':
  EN: wordCount = contentPrompt.split(/\s+/).length
  ZH: charCount = contentPrompt.replace(/[^\u4e00-\u9fff]/g, '').length

  EN (ESL targets — students are Chinese, English is L2):
  Age 6-8:  CHECK wordCount >= 15 AND <= 30
  Age 10-12: CHECK wordCount >= 30 AND <= 50
  Age 13-15: CHECK wordCount >= 50 AND <= 80
  Age 16-18: CHECK wordCount >= 75 AND <= 110

  ZH (Native targets — Chinese is L1, can handle more text):
  Age 6-8:  CHECK charCount >= 50 AND <= 90
  Age 10-12: CHECK charCount >= 100 AND <= 180
  Age 13-15: CHECK charCount >= 180 AND <= 250
  Age 16-18: CHECK charCount >= 250 AND <= 350

RESULT: PASS/FAIL per page + actual word/char count + language
```

**B3. AI Reading Difficulty Assessment (A12)**

```
For each handbook page where section === 'Reading':
  Extract the contentPrompt text.
  Call Gemini Flash with a low-cost prompt:
    "Assess this text's reading difficulty for a {ageGroup}-year-old {cefrLevel} ESL learner.
     Rate 1-5 (1=too easy, 3=just right, 5=too hard).
     Return JSON: { score: number, reason: string, suggestedCEFR: string }"

RESULT: PASS if all scores are 2-4 (appropriate range). FAIL if any score is 1 or 5.
```

**B4. Cross-Reference Validation (A13)**

```
Deterministic code checks — NO AI needed:

1. Vocabulary → Reading pages:
   For each word in vocabulary.keywords:
     CHECK at least one Reading page's contentPrompt contains that word (case-insensitive)
   RESULT: % of vocabulary words referenced in reading content

2. Supplies → Prop Checklist:
   For each item in supplies.permanent + supplies.consumables:
     CHECK the Prop Checklist page's contentPrompt mentions it
   RESULT: % of supply items listed in prop checklist

3. Roadmap phases → Activity pages:
   For each roadmap phase.activity name:
     CHECK at least one Activity/Worksheet page title or contentPrompt references it
   RESULT: % of roadmap activities with matching handbook pages

4. phaseSupplies → global supplies:
   For each item in roadmap[*].phaseSupplies:
     CHECK the item appears in either supplies.permanent or supplies.consumables
   RESULT: % of phase supplies present in global supply list

Overall RESULT: PASS if all percentages >= 80%
```

**B5. Age Differentiation Diff**

```
Compare handbook content between age 6-8 and age 10-12 (same mode):
- Average sentence length
- Vocabulary complexity (average word length)
- Number of comprehension questions
- Ratio of illustration instructions to text

RESULT: Quantified diff table showing that older group gets more complex content
```

**B6. Mode Differentiation Diff (3-way)**

```
Compare school vs family-esl vs family-pure for the same age group:
- Does family-esl include parent-guided ESL moments in each phase?
- Does family-pure use Chinese-only content with no ESL scaffolding?
- Does family-pure use warmer/informal tone vs school's instructional tone?
- Are roadmap phases named differently across modes?
- Does family-pure simplify equipment list?

RESULT: Summary of mode differences found (3-way comparison table)
```

**B7. Fact Sheet Quality Check**

```
For each kit that has a factSheet attached:
  CHECK: factSheet is non-empty and > 200 chars
  CHECK: factSheet references the lesson theme
  CHECK: factSheet contains at least 3 factual claims

RESULT: PASS/FAIL per kit
```

**B8. Structured vs Auto Handbook Comparison**

```
Compare the structured handbook kit (Step 5b) vs an auto-mode kit of the same age:
- Does structured mode follow the custom outline page-by-page?
- How does content depth compare?
- Are research grounding facts incorporated?

RESULT: Qualitative comparison summary
```

Output: `05-kit-review/review-[N]-[mode]-[age].md` (AI reviews)
Output: `05-kit-review/validation-checks.md` (automated checks)

### Step 7: Lesson Kit Optimization

Synthesize AI reviews + automated check results into optimization suggestions.

Output: `06-kit-fixes/optimization-plan.md`

### Step 8: Final Consolidated Report

Merge all findings into one report.

Output: `07-final-report/content-review-report.md`

Structure:

```markdown
# Nature Compass Content Review Report
Generated: [timestamp]
Theme: [theme], City: [city], Age Groups: [groups]

## Executive Summary
[2-3 paragraph overview]

## Scores Dashboard
| Component | ESL | Planner | Parent | Student | UI | Avg |
|-----------|-----|---------|--------|---------|-----|-----|
(all components with scores)

## Automated Validation Results
| Check | 6-8 School | 6-8 Family | 10-12 School | 10-12 Family |
|-------|-----------|-----------|-------------|-------------|
| Page Count (=15) | ... |
| Reading Word Count | ... |
| Age Diff Score | ... |
| Mode Diff Score | ... |

## Baseline Comparison (if available)
| Metric | Before | After | Delta |
(score changes from Step 0 baseline)

## Critical Findings
### Curriculum Issues
### Lesson Kit Issues
### Handbook Content Issues
### Code/Generation Errors Encountered
[All errors from _errors.log with suggested code fixes]

## Prompt Improvement Recommendations
### P0 — Must Fix
### P1 — Should Fix
### P2 — Nice to Have

## Performance Metrics
[From _timing.log — average response time, total tokens estimated]
```

### Step 9: Regression Testing (A14)

If a previous review's `_errors.log` exists (from Step 0 baseline):

1. Extract the failed/low-scoring cases from the previous run
2. Re-generate ONLY those specific cases (same age, mode, lesson number) using the current prompt
3. Compare: did the previously-failed case now succeed? Did the previously-low score improve?
4. Output a regression table:

```
| Case | Previous Result | Current Result | Regression? |
|------|----------------|----------------|-------------|
| lesson-1-family-10-12 | FAILED (JSON parse) | ... | ... |
| lesson-1-school-10-12 | 8/15 pages | ... | ... |
```

If no previous run exists, skip and note "No regression baseline available".

Output: `07-final-report/regression-test.md`

### Step 10: Architecture & UI/UX Pipeline Review

Read ALL core service files and this workflow definition file:

- `geminiService.ts` — main EN/CN streaming generation + fact sheet
- `curriculumService.ts` — curriculum generation (EN + CN)
- `structuredHandbookService.ts` — structured mode: research → plan → handbook
- `themeService.ts` — theme palette generation
- `contentGenerators.ts` — content generation utilities
- `imageService.ts` — image generation

Feed them to Gemini to review the entire generation pipeline from the perspective of an AI Software Engineer and a UI/UX Designer.
Append the review findings to `07-final-report/content-review-report.md`.

Output: Appended report in `07-final-report/content-review-report.md`

### Step 11: Generate Implementation Plan

Based on the optimization suggestions from Step 4 and Step 7, and the findings in the Final Report, generate a concrete, multi-stage implementation plan.
Ensure the plan evaluates feasibility and safety, clearly detailing how prompt changes or UI code changes should be applied globally across the codebase.

Output: `08-implementation-plan/implementation_plan.md`

### Step 12: Report to User

Use `notify_user` with:

- Path to the final report and implementation plan
- Score summary table
- Top 3 critical findings
- Baseline comparison (if applicable)
- Regression test results (if applicable)

## Error Handling

- **On any API error**: Log to `_errors.log` with full context, continue to next item
- **Rate limit (429)**: Wait 30s, retry up to 3 times
- **Timeout (>120s)**: Kill and retry once with simpler prompt
- **JSON parse failure**: Save raw response to `_errors.log`, skip this item
- All errors become part of the final report with code fix suggestions

## Estimated Time & Cost

| Step | API Calls | Time |
|------|-----------|------|
| Curricula | 2 | ~1 min |
| Curriculum Review | 2 + 1 | ~2 min |
| Fact Sheets | 3 | ~30s |
| Lesson Kits (3 regular) | **3** | ~3 min |
| Structured Kit (1) | **4** (extract+research+plan+handbook) | ~2 min |
| Kit Review (4 kits) | 4 + 1 | ~3 min |
| Validation | 0 (code only) | ~5s |
| Final Report | 1 | ~15s |
| **Total** | **~21** | **~12-15 min** |

Token estimate: ~250K total ≈ **$0.10-0.15**
