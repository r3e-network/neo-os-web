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

All scripts assume they are invoked from the repository root. Set the required
environment variables (tokens, DSNs, Azure credentials, etc.) beforehand.
