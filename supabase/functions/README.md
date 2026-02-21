# Supabase Functions (Export Target)

This folder is an **export target** for the reference Edge functions under:

- `platform/edge/functions/`

The repo keeps the canonical source in `platform/edge/functions/` to avoid
duplicating logic. To create a Supabase-compatible `supabase/functions/*`
layout for local use or deployment, run:

```bash
./scripts/export_supabase_functions.sh
```

After exporting, you can deploy from the `supabase/` folder using the Supabase
CLI (project-specific steps depend on your Supabase setup).

