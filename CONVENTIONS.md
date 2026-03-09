# Pathway Academy Toolkit — Development Conventions

## i18n — Mandatory Bilingual UI Text (EN + ZH)

**Every user-facing string in ALL apps MUST use the `t()` translation function. No exceptions.**

### Rules

1. **Never hardcode** display text in JSX. Always add a key to the app's `i18n/translations.ts` first.
2. **Every new key** must include both `en` and `zh` values.
3. **Print/PDF mode** inherits from the same `t()` calls — no extra work needed.
4. **Values sent to AI** (dropdown values used in prompts) stay in English — only the **display label** gets translated.
5. **Shared components** (`packages/shared`) use `commonTranslations` from `@shared/i18n/commonTranslations.ts`.

### How to add a new string

```typescript
// 1. Add to the app's i18n/translations.ts (or commonTranslations if shared)
'feature.newLabel': { en: 'New Label', zh: '新标签' },

// 2. Use in component
const { t } = useLanguage();
<button>{t('feature.newLabel')}</button>
```

### App-specific translation files

| App | Translation file |
|-----|-----------------|
| Nature Compass | `apps/nature-compass/i18n/translations.ts` |
| ESL Planner | `apps/esl-planner/i18n/translations.ts` |
| Shared | `packages/shared/i18n/commonTranslations.ts` |

### Key naming convention

Use dot-separated prefixes matching the component area:

- `nav.*` — header/navigation
- `input.*` — form labels & placeholders
- `tab.*` — tab names
- `saved.*` — records/saved projects pages
- `common.*` — shared across apps (in commonTranslations)
