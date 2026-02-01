# Distributed MiniApp Backend Design

**Goal:** Make the MiniApp platform backend consistent and production-ready by standardizing registry sources, manual publish flow, and schema alignment.

## Summary
The platform will treat `miniapp_submissions` and `miniapp_internal` as canonical sources and expose a unified `miniapp_registry_view` for discovery. External submissions are manually reviewed and built by admins, then published by uploading artifacts to a CDN and calling `miniapp-publish` with an absolute `entry_url` and selected asset URLs. Automated builds remain optional for internal-only flows.

## Current Issues
- Schema drift between `supabase/migrations` and `platform/supabase` causes missing columns and inconsistent view logic.
- Code references `miniapp_registry` and `miniapp_versions`, but distributed flow uses `miniapp_submissions` + `miniapp_registry_view`.
- `miniapp-build` attempts to build external submissions even though the desired flow is manual admin builds.
- `entry_url` is inferred from `cdn_base_url`, which is fragile across CDNs.

## Architecture
- Canonical registry sources:
  - `miniapp_submissions` (external)
  - `miniapp_internal` (internal prebuilt)
  - Unified via `miniapp_registry_view`
- Discovery:
  - Edge `miniapp-list` and admin/host registry queries use `miniapp_registry_view` only.
- Publish:
  - Admins build locally and upload to CDN.
  - Admin calls `miniapp-publish` with `entry_url` and `assets_selected`.

## Data Model Changes
Update `miniapp_submissions` to include:
- `entry_url TEXT` (absolute URL to index.html)
- `assets_selected JSONB` (icon/banner absolute URLs)
- `build_started_at TIMESTAMPTZ`
- `build_mode TEXT DEFAULT 'manual'` (manual | platform)

Normalize column naming to `manifest_hash` across code and SQL.

Update `miniapp_registry_view` to:
- emit `source_type = 'external'` for submissions and `source_type = 'internal'` for internal apps
- use `entry_url` directly (no implicit `cdn_base_url` to index fallback)
- prefer `assets_selected` over `assets_detected` over `manifest` URLs
- only include published external apps and active internal apps

Schema should be maintained in `supabase/migrations/*` and exported to `platform/supabase` via the existing export process. Documentation should reference the canonical location.

## Workflow
### External submission
1. Developer submits Git URL to `miniapp-submit`.
2. Submission stored with status `pending_review`.
3. Admin reviews code out-of-band.
4. Admin builds locally, uploads to CDN.
5. Admin calls `miniapp-publish` with `entry_url` and `assets_selected`.
6. Submission status becomes `published`.

### Internal miniapps
- Managed via `miniapp_internal` (prebuilt bundles)
- Included in `miniapp_registry_view`

## API Behavior
- `miniapp-approve`:
  - updates status
  - writes `miniapp_approval_audit` row
  - does not trigger build unless `build_mode = 'platform'`
- `miniapp-build`:
  - rejects submissions with `build_mode = 'manual'`
  - remains for internal/explicit platform builds
- `miniapp-publish`:
  - validates status is `approved` or `building`
  - validates `entry_url` is absolute HTTPS
  - if `CDN_BASE_URL` is set, require `entry_url` and assets to be under that origin

## Security and Validation
- Git URL whitelist remains enforced at submit.
- Strict status transitions prevent accidental publish.
- `entry_url` and `assets_selected` must be absolute URLs; reject non-HTTPS.
- Optional allowlist via `CDN_BASE_URL`.

## Testing
- SQL view test to assert:
  - `miniapp_internal` union included
  - `assets_selected` precedence
  - `entry_url` selection
- Edge tests:
  - `miniapp-publish` validation (invalid URL, status mismatch)
  - `miniapp-build` rejection for manual submissions
- Admin registry tests:
  - registry endpoint reads `miniapp_registry_view`

## Rollout
1. Add forward migrations for new columns in `supabase/migrations`.
2. Update view definition and tests.
3. Update edge functions (`miniapp-build`, `miniapp-publish`, `miniapp-list`).
4. Update admin console to show manual publish flow for external submissions.
5. Update docs (`distributed-miniapps-guide`, checklist).

## Non-goals
- Migrating to `miniapp_registry` + `miniapp_versions` as canonical.
- Automated builds for external submissions.
