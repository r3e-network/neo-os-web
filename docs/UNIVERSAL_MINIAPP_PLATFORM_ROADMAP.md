# Universal MiniApp Platform Roadmap

This roadmap describes the target architecture: no per-app frontend coding, no per-app contract handcrafting.

## Target State

1. Contract layer is template-driven:
   - `MiniAppFactory` stores multiple contract templates (`nef` + `manifest`).
   - Developers deploy app contracts by selecting `templateId` + init params.
   - Optional one-call registration to `AppRegistry`.
2. Frontend layer is definition-driven:
   - Every miniapp page is rendered from `frontend_spec`/`page_template` + `operations`.
   - Right operation panel stays visually consistent across apps (Polymarket style).
   - Left panel content/tabs are configurable from JSON/YAML/Markdown.
3. Admin layer is config-first:
   - Create/update/publish/disable through admin API.
   - No new frontend route/component required when adding an app.

## Current Capabilities (After This Change)

1. `host-app` supports `frontend_spec` parsing from:
   - JSON object
   - YAML string
   - Markdown string (auto-mapped to an Overview content tab)
2. Admin normalization persists canonical manifest fields:
   - `detail_template` / `page_template`
   - `operations`
   - `frontend_spec`
3. New contract `MiniAppFactory` is added:
   - Template CRUD
   - Deploy from template
   - Deploy + register flow with `AppRegistry`
4. Host catalog can now consume JSON definitions from:
   - `platform/host-app/public/miniapp-definitions/*.json`
   - definitions override built-in metadata when `app_id` matches
5. Admin API now supports batch file import:
   - `POST /api/miniapps/admin/import-definitions`
   - optional dry-run for validation (`dry_run=true`)
6. Admin console includes batch import controls:
   - `Validate Definitions` / `Import Definitions`
   - proxies to host-app admin endpoint via `MINIAPP_HOST_APP_BASE_URL`

## Migration Plan For Existing MiniApps

1. Classify each existing app into template families:
   - `prediction`, `gaming`, `defi`, `nft`, `default`
2. For each app, migrate metadata into manifest config:
   - `frontend_spec` or `page_template`
   - `operations`
   - content blocks/tabs/docs links
   - Bootstrap per-app JSON files via:
     - `./scripts/scaffold-miniapp-definitions.sh`
     - add `--force` to overwrite existing generated files
3. Keep only static assets in app folders (`public/logo.*`, `public/banner.*`) during migration.
4. Move contract deployment to `MiniAppFactory` template IDs.
5. Freeze per-app frontend implementations and route all new apps through config-only creation.
6. Run one batch import after each migration chunk:
   - `POST /api/miniapps/admin/import-definitions?dry_run=true`
   - then execute without dry-run when validation is clean.

## Next Implementation Steps

1. Add admin-console flows for factory template lifecycle (`create template`, `toggle`, `deploy`).
2. Add DB table for template metadata mirror (`miniapp_contract_templates`) and deployment records.
3. Add migration script to generate `frontend_spec` for all existing built-in miniapps.
4. Enforce policy in CI: reject new per-app frontend pages unless explicitly approved.

## Versioning & Rollback (Implemented)

1. Draft/published version model is now introduced.
   - See `docs/MINIAPP_VERSIONING_MODEL.md`.
2. New migration:
   - `migrations/053_miniapp_versions.sql`
3. New host admin APIs:
   - `GET /api/miniapps/admin/versions`
   - `POST /api/miniapps/admin/rollback`
4. Admin console proxies + hooks:
   - `GET /api/miniapps/versions`
   - `POST /api/miniapps/rollback`
   - version history and rollback controls in miniapp detail view.
