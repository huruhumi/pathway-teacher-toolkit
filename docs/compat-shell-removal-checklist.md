# Compatibility Shell Removal Checklist

This checklist defines when and how to remove legacy `geminiService` compatibility barrels safely.

## Shell files under watch

- `apps/esl-planner/services/geminiService.ts`
- `apps/nature-compass/services/geminiService.ts`
- `apps/essay-lab/services/geminiService.ts`

## Removal gate

All conditions must be met:

1. `npm run check:compat-shells` returns success (zero legacy imports in app code).
2. The check remains green for at least two release cycles.
3. There are no external scripts/docs/plugins still importing the shell paths.

## Verification commands

Run in repo root:

```bash
npm run check:compat-shells
npm run typecheck
npm run build
```

Optional integrated scan:

```bash
npm run scan
```

## Replacement map

- ESL lesson kit generation:
  - from `apps/esl-planner/services/geminiService.ts`
  - to `apps/esl-planner/services/lessonKitService.ts` and feature services:
    - `apps/esl-planner/services/itemGenerators.ts`
    - `apps/esl-planner/services/worksheetService.ts`
    - `apps/esl-planner/services/curriculumService.ts`

- Nature Compass lesson kit flow:
  - from `apps/nature-compass/services/geminiService.ts`
  - to:
    - `apps/nature-compass/services/lessonKitService.ts`
    - `apps/nature-compass/services/contentGenerators.ts`
    - `apps/nature-compass/services/themeService.ts`
    - `apps/nature-compass/services/curriculumService.ts`
    - `apps/nature-compass/services/imageService.ts`
    - `apps/nature-compass/services/gemini/poster.ts`

- Essay correction:
  - from `apps/essay-lab/services/geminiService.ts`
  - to `apps/essay-lab/services/essayCorrectionService.ts`

## Final cleanup steps

1. Delete the three shell files.
2. Run:
   - `npm run check:compat-shells`
   - `npm run typecheck`
   - `npm run build`
3. If any import is reported, restore the shell and migrate remaining caller(s) first.
