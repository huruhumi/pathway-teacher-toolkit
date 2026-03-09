---
description: Auto-commit and push to GitHub — run periodically during coding sessions to avoid losing work
---

# Auto-Push Workflow

// turbo-all

Automatically commits staged changes and pushes to GitHub. Should be triggered every ~15 tool calls during active development sessions.

## AUTOMATION RULES

> **ZERO human interaction** during this workflow.
> Commit message is auto-generated based on changed files.
> If nothing to commit, silently skip.

## Steps

### Step 1: Check for changes

```
git status --short
```

If output is empty, log "Nothing to commit" and **stop** — do not proceed to Step 2.

### Step 2: Stage all changes

```
git add -A
```

### Step 3: Generate commit message and commit

Analyze the staged files to determine what changed:

- If changes span multiple apps: `chore: update [app1], [app2], and shared packages`
- If changes are in one app: `feat([app-name]): [brief description based on file names]`
- If only config/workflow files: `chore: update config and workflows`

```
git commit -m "[generated message]"
```

### Step 4: Push to origin

```
git push origin main
```

### Step 5: Log result

Log the commit hash and number of files changed. No need to notify the user.

## Integration

This workflow should be called:

- Every ~15 tool calls during active coding
- Before switching to a different conversation topic
- At end of session (via /cleanup workflow)
- After completing any major task boundary

## Error Handling

- **Push rejected (non-fast-forward)**: Run `git pull --rebase origin main` then retry push
- **Auth failure**: Log warning and continue — user will need to re-authenticate manually
- **Merge conflict on rebase**: Abort rebase (`git rebase --abort`), log error, notify user
