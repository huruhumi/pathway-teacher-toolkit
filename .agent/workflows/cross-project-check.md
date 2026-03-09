---
description: Cross-project impact check — run mentally before finalizing any code change
---

# Cross-Project Impact Check

This monorepo has multiple sub-apps that share patterns. Before completing any change, check if it should propagate.

## Project Map

| App | Path | Storage Hook | Schema Migration |
|-----|------|-------------|-----------------|
| Nature Compass | `apps/nature-compass/` | `App.tsx` → `useProjectCRUD` | `utils/schemaMigration.ts` |
| ESL Planner | `apps/esl-planner/` | `hooks/useLessonHistory.ts` → `useProjectCRUD` | `utils/schemaMigration.ts` |
| Essay Lab | `apps/essay-lab/` | TBD | TBD |

## Shared Layer (`packages/shared/`)

Changes here affect ALL apps. Key shared modules:

- `hooks/useProjectCRUD.ts` — CRUD + Supabase sync
- `services/cloudSync.ts` — Supabase CRUD operations
- `stores/useAuthStore.ts` — Auth state
- `components/` — Shared UI components
- `types/schemas.ts` — Zod validation schemas
- `safeStorage.ts` — localStorage wrapper (legacy, being phased out)

## Checklist (ask user before applying)

When making a change, check these categories:

### 1. Type/Schema Changes

- [ ] Did you modify `types.ts` in one app? → Check if the other app has similar types
- [ ] Did you add a field? → Add migration in that app's `utils/schemaMigration.ts`
- [ ] Did you modify `packages/shared/types/schemas.ts`? → All apps affected

### 2. Storage Changes

- [ ] Changed how data is saved/loaded? → Both apps use `useProjectCRUD`
- [ ] Added a new Supabase table? → May need RLS policies

### 3. UI/Component Changes

- [ ] Changed a shared component in `packages/shared/`? → All apps affected
- [ ] Added a feature to one app's UI? → Ask user if other app needs it too

### 4. Prompt/AI Changes

- [ ] Modified a generation prompt? → Only affects that app (no cross-app impact)
- [ ] Changed AI service patterns? → Check if other app uses similar patterns

### 5. Auth/i18n Changes

- [ ] Changed auth flow? → Affects landing page + all apps
- [ ] Changed i18n? → Check if both apps have parallel translation files

## How to Apply

Before finalizing changes, tell the user:
> "这个改动也适用于 [其他项目名]，要一起改吗？"

Wait for confirmation before propagating.
