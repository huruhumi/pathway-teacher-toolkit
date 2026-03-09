---
description: Pre-deploy build check — run before pushing to GitHub to avoid wasting a Vercel deployment
---

# Deploy Check

// turbo-all

Runs a full build of all apps to catch errors before pushing to GitHub (which triggers a Vercel deploy).

## Steps

### 1. Check for uncommitted changes

```bash
git status --short
```

If there are uncommitted changes, warn the user and ask if they want to commit first.

### 2. Build all apps

Run the full build to catch TypeScript errors, missing imports, etc:

```bash
npm run build
```

This builds: esl-planner, essay-lab, nature-compass, rednote-ops, edu-hub, student-portal, and the landing page.

### 3. Report results

If build succeeds:

- Tell the user it's safe to push
- Show current commit count ahead of origin: `git rev-list --count origin/main..main`
- Ask if they want to push now

If build fails:

- Show the error output
- Identify which app failed
- Offer to fix the issue

### 4. Push (if requested)

```bash
git push origin main
```
