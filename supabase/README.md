# Supabase (Project Integration)

This repository uses **Supabase** as the user-facing gateway and storage layer:

- **Auth**: Supabase Auth (GoTrue) issues user JWTs (`Authorization: Bearer <jwt>`).
- **Gateway**: Supabase Edge Functions expose `/functions/v1/*` endpoints.
- **Storage**: Postgres (RLS) + encrypted secrets (via `SECRETS_MASTER_KEY`).

## Functions

The canonical Edge function source lives under:

- `platform/edge/functions/`

`supabase/functions/` is treated as an **export target** for Supabase-compatible
deployment layouts. To populate it, run:

```bash
make export-supabase-functions
```

Then deploy with the Supabase CLI (project-specific configuration required).

