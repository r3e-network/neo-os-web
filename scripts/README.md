# Scripts

Automation under this directory supports the testing, delivery, and operational
workflows described in [`docs/requirements.md`](../docs/requirements.md). Update
that specification first whenever a new script is added or an existing workflow
changes so the tooling remains discoverable.

## Top-Level Helpers
- `run_unit_tests.sh` – runs the curated `go test -short` suite covering
  `cmd/appserver`, `cmd/slctl`, and the core packages.
- `security_scan.sh` – installs (if needed) and runs `gosec`, `nancy`, and a set
  of heuristic greps, writing reports to `security-reports/`.
- `deploy_azure.sh` – builds the container image and deploys it to Azure
  Container Instances with confidential-compute settings. Update resource names,
  registries, and identities before running.
- `supabase_smoke.sh` – brings up the Supabase compose profile (GoTrue/PostgREST/Kong/Studio) and runs a minimal health check (`/auth/refresh` via the appserver + `/system/status`).

### Supabase profile smoke
- Requires Docker, curl, jq. Assumes `.env` exists (auto-copies from `.env.example` if missing).
- Runs `docker compose --profile supabase up -d --build`, waits for GoTrue and PostgREST health, hits the appserver `/auth/refresh` when `SUPABASE_REFRESH_TOKEN` is set, and curls `/system/status`.
- To stop services: `docker compose --profile supabase down --remove-orphans`.

All scripts assume they are invoked from the repository root. Set the required
environment variables (tokens, DSNs, Azure credentials, etc.) beforehand.
