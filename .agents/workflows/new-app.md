---
description: Scaffold a new app in the monorepo with consistent structure, routing, and shared config
---

# New App Scaffold

This workflow creates a new app inside `apps/` with the same structure and configuration as existing apps.

## Prerequisites

Ask the user for:

1. **App name** (kebab-case, e.g. `quiz-maker`)
2. **Display name** (e.g. `Quiz Maker`)
3. **Brief description** of the app's purpose

## Steps

### 1. Reference an existing app's structure

Use `apps/nature-compass/` or `apps/esl-planner/` as reference. Check the latest package.json, vite.config.ts, tsconfig.json, and index.html to match conventions.

### 2. Create the app directory

Create `apps/[app-name]/` with at minimum:

```
apps/[app-name]/
├── index.html
├── index.css
├── index.tsx          # entry point
├── App.tsx            # main app component
├── package.json       # with same deps as sibling apps
├── tsconfig.json      # extending root config
├── vite.config.ts     # matching sibling config
└── components/        # empty, ready for components
```

### 3. Configure package.json

Copy structure from a sibling app's package.json. Key fields:

- `name`: `@pathway/[app-name]`
- `scripts`: must include `dev` and `build`
- `dependencies`: include react, react-dom, and any shared deps

### 4. Wire up shared packages

Import shared styles and any needed utilities:

```tsx
// index.css
@import '../../packages/shared/styles/tokens.css';
```

### 5. Register in root package.json

Add to root `package.json`:

```json
"dev:[shortname]": "npm -w apps/[app-name] run dev",
"build:[shortname]": "npm -w apps/[app-name] run build"
```

Also add the build command to the `build:apps` script chain.

### 6. Add Vercel config (if needed)

If the app should be deployed, check `vercel.json` or project settings for routing.

### 7. Register in landing page / edu-hub

If applicable, add the new app's link to `apps/edu-hub/` or the landing page so users can navigate to it.

### 8. Test

```bash
npm run dev:[shortname]
```

Verify the app starts without errors on its dev server.

### 9. Add i18n support

If the app needs internationalization, set up the i18n config following the pattern in `packages/shared/i18n/` and `i18n.js`.
