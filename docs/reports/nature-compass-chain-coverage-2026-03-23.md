# Nature Compass Chain Coverage Matrix (2026-03-23)

## Objective
- Verify generation logic continuity for:
  - School mode
  - Family mode (English exploration ON)
  - Family mode (English exploration OFF / pure exploration)
- Verify rainy-mode propagation across all major stages:
  - Phase1 roadmap generation
  - Phase2 handbook/downstream generation
  - Single-phase regeneration
  - Structured mode path
- Verify quota/freshness policy and strict page allocation controls.

## Scenario Matrix

### Scenario A: School mode
- Phase1 lens:
  - `services/gemini/streaming.ts:99` (`Roadmap Audience Lens - School`)
- ESL school path:
  - `services/gemini/streaming.ts:71`
  - `services/gemini/streaming.ts:121`
- Phase2 teacher/student quality lens:
  - `services/gemini/supportingContent.ts:198`

### Scenario B: Family mode + English exploration ON
- Phase1 family lens:
  - `services/gemini/streaming.ts:93`
- Light English rules:
  - `services/gemini/streaming.ts:71`
  - `services/gemini/curriculumRegenerate.ts:89`
- Phase2 parent/child content lens:
  - `services/gemini/supportingContent.ts:185`
  - `services/gemini/supportingContent.ts:193`

### Scenario C: Family mode + English exploration OFF
- Pure exploration enforcement:
  - `services/gemini/streaming.ts:233`
  - `services/gemini/curriculumRegenerate.ts:72`
  - `services/gemini/curriculumRegenerate.ts:89`
- Phase2 remains parent/child lens (no forced ESL):
  - `services/gemini/supportingContent.ts:185`

### Rainy Mode Propagation
- Phase1:
  - `services/gemini/streaming.ts:127`
  - `services/gemini/streaming.ts:295`
- Phase2:
  - `services/gemini/supportingContent.ts:273`
  - `services/gemini/supportingContent.ts:275`
- Regeneration:
  - `services/gemini/curriculumRegenerate.ts:70`
  - `services/gemini/curriculumRegenerate.ts:77`
- Structured path:
  - `services/gemini/structuredPrompts.ts:82`
  - `services/gemini/structuredPrompts.ts:130`

## Freshness / Grounding / Quota Controls
- Degrade sequence present:
  - `services/groundingService.ts:15` (`['1y','3y','5y']`)
- Freshness/risk metadata + coverage:
  - `services/groundingService.ts:387`
  - `services/groundingService.ts:446`
- Degrade audit notes:
  - `services/groundingService.ts:487`
  - `services/groundingService.ts:540`
- Structured topic research now uses unified grounding:
  - `services/structuredHandbookService.ts:21`
  - `services/structuredHandbookService.ts:125`
  - `services/groundingService.ts:567`
- Batch shared fact sheet + controlled concurrency:
  - `hooks/useBatchGenerate.ts:23` (concurrency=2)
  - `hooks/useBatchGenerate.ts:62` (shared fact sheet)
  - `hooks/useBatchGenerate.ts:161` (runWithConcurrency)

## Strict Page Allocation Path
- UI planner + validation:
  - `components/PhaseHandbookPlanner.tsx:81`
  - `components/PhaseHandbookPlanner.tsx:95`
- Commit gate:
  - `components/LessonPlanDisplay.tsx:703`
- Phase2 strict prompt block:
  - `services/gemini/supportingContent.ts:281`
- Phase2 strict runtime validation:
  - `services/gemini/supportingContent.ts:69`

## User-Reported Text Fixes
- Language toggle text fixed:
  - `components/LessonPlanDisplay.tsx:1127` (`EN / 中文`)
- Description placeholder key leak fixed:
  - `components/CurriculumPlanner.tsx:249`
  - `i18n/translations.ts:54`

## Verification Commands
- `npm -w apps/nature-compass run lint` -> PASS
- `npm -w apps/nature-compass run build` -> PASS

## Remaining Validation Gap
- Live API-output E2E quality runs (real model calls) were not executed in this local static pass.
- Code-level coverage checks and compile/build checks are complete.
