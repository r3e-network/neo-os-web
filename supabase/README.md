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

## Local Development (Supabase CLI)

This repo includes a minimal `supabase/config.toml` and Make targets to run
Supabase locally via a dockerized CLI wrapper:

```bash
make supabase-start
make supabase-status
```

Local migrations and functions are exported into `supabase/migrations/` and
`supabase/functions/` before startup.

To run the Edge gateway locally without the Supabase CLI (requires Deno):

```bash
make edge-dev
```

When running the Supabase CLI via `./scripts/supabase.sh`, environment variables
are loaded from:

- `.env` (repo root), if present
- `supabase/.env`, if present

If your environment cannot pull the Supabase CLI container image (registry
mirrors / restricted networks), install the Supabase CLI locally and rerun:

```bash
make supabase-cli-install
make supabase-start
```

You can also override the container image used by `./scripts/supabase.sh`:

- `SUPABASE_CLI_IMAGE=...` (e.g. `registry-1.docker.io/supabase/cli:latest` or `ghcr.io/supabase/cli:latest`)
