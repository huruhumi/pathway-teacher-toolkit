---
description: Cross-project impact check — run mentally before finalizing any code change
---

# Auto-Trigger Rules

These rules define when workflows should be triggered automatically without the user needing to ask.

## Rules

### After modifying `packages/shared/`

**Trigger**: Any file in `packages/shared/` is modified  
**Action**: Automatically run `/sync-shared` to check which apps are affected and verify they still build  
**Behavior**: Run silently, only report if there are issues

### After database schema changes

**Trigger**: A Supabase migration is applied via `/db-migrate` or `apply_migration`  
**Action**: Automatically run security + performance advisors  
**Behavior**: Always report results, especially RLS warnings

### When the user says they're done for the day

**Trigger**: User says something like "收工", "今天到这", "done for today", "wrap up", "结束", "下班"  
**Action**: Automatically run `/cleanup`  
**Behavior**: Run full cleanup and report summary

### Before a manual push to GitHub

**Trigger**: User asks to push, or when auto-push hook fires (15 commits reached)  
**Action**: Suggest running `/deploy-check` first  
**Behavior**: Ask once, don't block if user declines

### At the start of every work session

**Trigger**: First message of a new conversation, or when starting any work on the project  
**Action**: Silently check for zombie dev servers on ports 3001-3006:

```powershell
netstat -ano | findstr "3001 3002 3003 3004 3005 3006"
```

If any are found, kill them immediately without asking:

```powershell
taskkill /F /PID <PID>
```

**Behavior**: Report what was cleaned up, e.g. "清理了 3 个僵尸 dev server，释放了内存"

### When user mentions code quality

**Trigger**: User says "检查代码", "代码质量", "code review", "健康检查", "debug", "优化代码", "code health"  
**Action**: Automatically run `/code-health`  
**Behavior**: Run full check and generate health report

### When scaffolding a new app

**Trigger**: User mentions creating a new tool/app/页面/应用  
**Action**: Suggest using `/new-app` workflow  
**Behavior**: Ask the user for app name and description, then follow the workflow
