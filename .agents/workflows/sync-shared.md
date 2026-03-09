---
description: Check which apps are affected when packages/shared changes — run before committing shared code changes
---

# Sync Shared — Impact Check

// turbo-all

When you modify files in `packages/shared/`, this workflow identifies which apps are affected and verifies they still build correctly.

## Steps

### 1. Identify changed shared files

```bash
git diff --name-only HEAD -- packages/shared/
```

If no changes, also check staged files:

```bash
git diff --cached --name-only -- packages/shared/
```

List all changed files in `packages/shared/`.

### 2. Find which apps import the changed files

For each changed shared file, search for imports across all apps:

```bash
grep -rl "shared/[changed-file-path]" apps/
```

Also search for re-exports or barrel imports that reference the changed modules.

Report a table like:

| Changed Shared File | Affected Apps |
|---|---|
| `styles/tokens.css` | esl-planner, nature-compass, essay-lab |
| `hooks/useAutoSave.ts` | nature-compass |

### 3. Build affected apps only

For each affected app, run its individual build:

- `npm run build:planner` (esl-planner)
- `npm run build:essay` (essay-lab)
- `npm run build:nature` (nature-compass)
- `npm run build:ops` (rednote-ops)
- `npm run build:edu` (edu-hub)
- `npm run build:student` (student-portal)

### 4. Report results

- List which apps passed / failed
- If any failed, show the error and offer to fix

## Notes

Key shared directories and their typical consumers:

| Shared Module | Typical Consumers |
|---|---|
| `styles/` | All apps (tokens.css, global styles) |
| `components/` | All apps |
| `hooks/` | Apps that use the specific hook |
| `services/` | Apps using Supabase or AI services |
| `stores/` | Apps using Zustand stores |
| `types/` | Apps importing shared type definitions |
| `i18n/` | Apps with internationalization |
| `utils/` | Various apps |
