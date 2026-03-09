---
description: Safely modify Supabase database schema with migration, type generation, and security checks
---

# Database Migration

Safely applies schema changes to the Supabase database with proper migrations, type generation, and security auditing.

**Supabase Project ID**: `mjvxaicypucfrrvollwm`

## Steps

### 1. Understand the change

Ask the user what database change they need. Common scenarios:

- Add a new table
- Add/modify columns
- Add indexes for performance
- Update RLS (Row Level Security) policies

### 2. Review current schema

Check current tables and structure:

```
mcp_supabase-mcp-server_list_tables (project_id: mjvxaicypucfrrvollwm, schemas: ["public"], verbose: true)
```

### 3. Apply migration

Use `mcp_supabase-mcp-server_apply_migration` with:

- `project_id`: `mjvxaicypucfrrvollwm`
- `name`: descriptive snake_case name (e.g. `add_quiz_results_table`)
- `query`: the DDL SQL

**IMPORTANT**: Always use `IF NOT EXISTS` for CREATE statements, and `IF EXISTS` for DROP statements.

### 4. Generate TypeScript types

After migration, regenerate types:

```
mcp_supabase-mcp-server_generate_typescript_types (project_id: mjvxaicypucfrrvollwm)
```

Save the output to the appropriate types file in the project (check where existing Supabase types are stored).

### 5. Run security advisor

Check for security issues (especially missing RLS policies):

```
mcp_supabase-mcp-server_get_advisors (project_id: mjvxaicypucfrrvollwm, type: "security")
```

### 6. Run performance advisor

Check for performance issues (missing indexes, etc.):

```
mcp_supabase-mcp-server_get_advisors (project_id: mjvxaicypucfrrvollwm, type: "performance")
```

### 7. Report results

Show the user:

- What migration was applied
- Any security warnings (especially RLS)
- Any performance suggestions
- Updated TypeScript types (if applicable)

## Notes

- **RLS is critical**: Every new table MUST have RLS enabled with appropriate policies
- **Never hardcode IDs**: Data migrations should not reference generated IDs
- Common RLS patterns for this project:
  - Public read, authenticated write
  - User-specific data (filter by `auth.uid()`)
