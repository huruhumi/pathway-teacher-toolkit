---
description: End-of-day cleanup — check unpushed commits, clean temp files, and run a quick health check
---

# Daily Cleanup

// turbo-all

End-of-day routine to make sure nothing is left behind.

## Steps

### 1. Check git status

```bash
git status --short
```

If there are uncommitted changes, list them and ask the user if they should be committed or discarded.

### 2. Check unpushed commits

```bash
git rev-list --count origin/main..main
```

If there are unpushed commits, tell the user the count and ask if they want to push now.

### 3. Clean temp files

Remove any temporary/scratch files:

```bash
del /s /q /tmp/check_*.js /tmp/bom_*.js /tmp/*.tmp 2>nul
```

Also check for any stray files in the project root that don't belong.

### 4. Quick build check

Run a quick TypeScript check (faster than full build):

```bash
npx tsc --noEmit -p apps/esl-planner/tsconfig.json
npx tsc --noEmit -p apps/nature-compass/tsconfig.json
npx tsc --noEmit -p apps/essay-lab/tsconfig.json
```

Only check apps that had changes today:

```bash
git diff --name-only @{yesterday}..HEAD -- apps/
```

### 5. Summary report

Report to the user:

- ✅ / ❌ All changes committed
- ✅ / ❌ All commits pushed
- ✅ / ❌ Temp files cleaned
- ✅ / ❌ TypeScript checks pass
- 📊 Stats: files changed today, commits made today
