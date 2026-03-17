# Monorepo Structure

## Goals

- Keep app code isolated from shared platform code
- Prevent `packages/shared` from growing as a catch-all bucket
- Give every cross-app dependency an explicit home and owner
- Make it obvious where to add new code during fast iteration

## Directory Rules

### `apps/`

Product applications only.

Each app should gradually converge on:

```text
src/
  app/
  features/
  entities/
  pages/
  i18n/
  lib/
  main.tsx
  App.tsx
```

Do not keep generated assets, logs, review snapshots, or one-off patch scripts in app roots.

### `packages/`

Reusable code with explicit boundaries.

- `@pathway/ui`: design-system and app-shell UI
- `@pathway/platform`: auth, logging, query providers, safe storage, shared app runtime helpers
- `@pathway/config`: shared TypeScript and Vite config
- `@pathway/shared-legacy`: temporary compatibility package while old imports are migrated

Future packages should be domain-oriented, for example:

- `@pathway/ai`
- `@pathway/education`
- `@pathway/notebooklm`
- `@pathway/i18n`
- `@pathway/utils`

### `tooling/`

Repository-level orchestration and developer utilities.

### `docs/`

Architecture notes and ADRs.

### `experiments/`

Temporary workflows, scratch implementations, and review artifacts that should not live beside production code.

## Shared Code Admission Rules

Move code into a package only when all three are true:

1. The code is used by at least two apps.
2. The behavior is stable enough that other apps can depend on it.
3. The module does not depend on app-specific feature types or local state.

If any of the above is false, keep it inside the owning app.

## Current Migration Plan

### Phase 1

- Add `packages/*` to workspaces
- Introduce `@pathway/ui` and `@pathway/platform`
- Keep `@shared/*` imports working during transition
- Start documenting repository conventions

### Phase 2

- Move app-shell and shared UI imports to `@pathway/ui`
- Move auth/logging/provider imports to `@pathway/platform`
- Reduce direct imports from `packages/shared`

### Phase 3

- Split `packages/shared` into domain packages
- Remove legacy aliases once app imports are migrated

## Refactoring Priorities

1. `apps/nature-compass/services/geminiService.ts`
2. `apps/esl-planner/hooks/useExportUtils.ts`
3. `apps/esl-planner/components/tabs/LessonPlanTab.tsx`

These should be broken into prompt builders, schemas, mappers, and orchestration modules instead of single large files.
