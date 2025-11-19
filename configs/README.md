# Configuration Reference

All configuration expectations, required environment variables, and runtime flags
are defined in the [`Neo Service Layer Specification`](../docs/requirements.md).
This directory simply contains samples you can copy when bootstrapping local
environments.

## Files
- `config.yaml` – canonical YAML sample consumed by `cmd/appserver`. Uncomment or
  edit sections before passing `-config configs/config.yaml`.
- `examples/appserver.json` – JSON version used in documentation snippets.
- `prometheus.yml` – example scrape config aligned with the `/metrics` surface.

Always update the specification first when adding/removing configuration fields.
