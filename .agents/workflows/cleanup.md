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

```powershell
if (Test-Path C:\tmp\check_*.js) { Remove-Item C:\tmp\check_*.js -Force }
if (Test-Path C:\tmp\bom_*.js) { Remove-Item C:\tmp\bom_*.js -Force }
if (Test-Path C:\tmp\*.tmp) { Remove-Item C:\tmp\*.tmp -Force }
```

Also check for any stray files in the project root that don't belong.

### 4. Quick build check

Run a quick TypeScript check (faster than full build).
Only check apps that had changes today:

```powershell
git log --since="midnight" --name-only --pretty=format: -- apps/ | Sort-Object -Unique | Where-Object { $_ -match '^apps/' }
```

Then run tsc for each affected app:

```bash
npx tsc --noEmit -p apps/esl-planner/tsconfig.json
npx tsc --noEmit -p apps/nature-compass/tsconfig.json
npx tsc --noEmit -p apps/essay-lab/tsconfig.json
```

### 5. Summary report

Report to the user:

- ✅ / ❌ All changes committed
- ✅ / ❌ All commits pushed
- ✅ / ❌ Temp files cleaned
- ✅ / ❌ TypeScript checks pass
- 📊 Stats: files changed today, commits made today

### 6. Session handoff summary

Generate two artifact files in the current conversation's brain directory:

1. **`session_summary.md`** — Contains:
   - 已完成的工作（列出改动的文件和功能）
   - 未完成的工作和已知 bug
   - 环境状态（端口、auth、数据库状态等）
   - 当前 conversation ID

2. **`tomorrow_plan.md`** — Contains:
   - 按优先级排列的明日开发计划（P0/P1/P2）
   - 每个任务的具体验证步骤
   - 如何在新对话中引用这两个文件

Tell the user: in the next conversation, say:

```
继续上次的 session，conversation ID: <当前会话ID>
先读一下 session_summary.md 和 tomorrow_plan.md
```
