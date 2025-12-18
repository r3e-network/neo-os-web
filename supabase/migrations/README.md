This directory is a **Supabase CLI export target**.

- Canonical SQL migrations live in `migrations/` (numbered `NNN_name.sql`).
- `make export-supabase-migrations` generates Supabase-compatible migrations in this folder (14-digit version prefix).

To regenerate:

```bash
make export-supabase-migrations
```

To run Supabase locally (Auth + DB + Edge Functions):

```bash
make supabase-start
```

