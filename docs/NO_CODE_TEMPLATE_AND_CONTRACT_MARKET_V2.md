# No-Code MiniApp + Contract Template Market V2

## Scope
This iteration formalizes a no-code model where a MiniApp can be fully created and evolved from JSON/YAML configuration, including:

- frontend template binding
- contract template binding and parameter schema
- localized metadata
- media variants (logo/banner)
- extensible logic and marketplace metadata

## Key Contract
The canonical schema is `platform/host-app/public/miniapp-definitions/miniapp-config.schema.json`.

### Notable capabilities
- `template_type` now supports both built-in families and custom IDs (pattern-based).
- `frontend_spec` accepts structured object, markdown string, or `{ format, content }` wrapper.
- `contract_template` supports advanced parameterization:
  - `init_params`
  - `init_schema`
  - `method_schema`
  - `security_profile`
  - `factory_template_ref`
  - `requires_host_capability`
  - `min_factory_version` / `max_factory_version`
- `security_profile` now supports first-class audit metadata:
  - `audit_provider`
  - `audit_hash`
  - `audit_date`
- schema is extensible for custom fields (`additionalProperties: true`).

## Media Strategy (Banner + Logo)
Use `media.logo_variants` and `media.banner_variants` as the source of truth.

Variant model:
- `url` (required)
- `theme`: `light | dark | any`
- `density`: `1x | 2x | 3x`
- `locale`: optional locale key (for example `en`, `zh-CN`)

Resolution strategy in runtime:
1. explicit URL from app row
2. best-matching variant (theme/density/locale)
3. conventional static asset fallback (`/miniapp-assets/<slug>/...`)

Recommended production asset spec:
- `logo`: square, `512x512`, transparent `png` or `webp`
- `banner`: `3:1` ratio, recommended `1500x500`, `jpg` or `webp`
- keep one `theme=any` baseline variant, then optionally add `light` and `dark`
- for high-density phones, add `density=2x` variant before `3x`
- locale-specific marketing banners use `locale` (example: `zh-CN`, `en`)

CDN domain strategy:
- production canonical: `https://meshmini.app`
- development fallback: R2 public URL (`*.r2.dev`) only for debugging
- avoid mixing hostnames inside one MiniApp; keep all variants under the same CDN origin for stable cache behavior

### Cloudflare R2 Upload Integration
This repository now includes signed-upload support for Cloudflare R2:

- Host endpoint: `platform/host-app/pages/api/miniapps/admin/media/upload-url.ts`
- Admin proxy endpoint: `platform/admin-console/src/app/api/miniapps/admin/media/upload-url/route.ts`
- Admin UI upload controls: `platform/admin-console/src/app/miniapps/page.tsx` (Content tab)
- Admin UI now supports variant-aware upload for `logo`/`banner`:
  - optional `theme` (`light|dark|any`)
  - optional `density` (`1x|2x|3x`)
  - optional `locale`
  - toggle to apply uploaded URL as primary field or only append/update variant JSON

Required env vars (host-app runtime):

- `MINIAPP_R2_ACCOUNT_ID=bf0d7e814f69945157f30505e9fba9fe`
- `MINIAPP_R2_BUCKET=miniapps`
- `MINIAPP_R2_ACCESS_KEY_ID=<r2 access key>`
- `MINIAPP_R2_SECRET_ACCESS_KEY=<r2 secret key>`
- `MINIAPP_MEDIA_PUBLIC_BASE_URL=https://meshmini.app`
- Optional: `MINIAPP_R2_SIGNED_URL_EXPIRES_SECONDS=900`

Upload object key convention:

- `miniapp-assets/<app_id>/icon.<ext>`
- `miniapp-assets/<app_id>/logo.<ext>`
- `miniapp-assets/<app_id>/banner.<ext>`
- Variant upload key (when specified): `logo.dark.2x.zh-cn.<ext>` style suffixes

R2 CORS checklist (required for browser direct `PUT` upload):

- allow your admin-console origin(s), for example `https://admin.meshmini.app` and local dev origin
- allow methods: `PUT`, `GET`, `HEAD`, `OPTIONS`
- allow headers: `Content-Type`, `Cache-Control`
- expose headers as needed (optional): `ETag`

Example CORS rule:

```json
[
  {
    "AllowedOrigins": ["https://admin.meshmini.app", "http://localhost:3001"],
    "AllowedMethods": ["PUT", "GET", "HEAD", "OPTIONS"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Admin Console No-Code UX
`platform/admin-console/src/app/miniapps/page.tsx` now includes:

- template binding fields (frontend + contract)
- automatic contract init-parameter form generation from `contract_template.init_schema`
- JSON editors for:
  - frontend template params
  - contract init params/schema/method schema/security profile
  - contract compatibility constraints (`requires_host_capability`, factory semver range)
  - contract audit metadata (provider/hash/date)
  - logic metadata
  - marketplace metadata
  - logo/banner variants
- zh localized name/description fields
- batch upload mode (JSON/YAML files) with validate/import + rollback-last-batch controls
- per-item batch import/rollback detail tables for operational visibility

`platform/admin-console/src/app/templates/page.tsx` now supports:

- install selected marketplace template directly into MiniApp Builder (`/miniapps`) via one-click draft handoff
- preserving template metadata (`template_id/version/variant`, params/schema/security metadata) during install

### Batch Upload + Rollback
Uploaded file flow is now available in admin console:

1. Select multiple JSON/YAML definition files.
2. Run `Validate Uploaded Batch` (dry-run).
3. Run `Import Uploaded Batch`.
4. If needed, run `Rollback Last Batch` using the generated rollback plan.

Endpoints:

- Host import API: `platform/host-app/pages/api/miniapps/admin/import-batch.ts`
- Host rollback API: `platform/host-app/pages/api/miniapps/admin/import-batch-rollback.ts`
- Admin proxy import API: `platform/admin-console/src/app/api/miniapps/import-batch/route.ts`
- Admin proxy rollback API: `platform/admin-console/src/app/api/miniapps/import-batch/rollback/route.ts`

`platform/admin-console/src/app/templates/page.tsx` now includes:

- JSON/YAML template file upload with auto-fill
- `schema` + `ui_schema` editors for parameter-driven template UX

## Marketplace Model
Template publish flows remain approval-aware and compatible with existing review logic.
The payload now better captures contract-level capabilities so template consumers can render strongly-typed parameter forms.

## Design Notes Inspired by Current Smart Contract Ecosystem
This contract template model is aligned with widely-used directions in modern smart contract systems:

- parameterized deployment over one-off contract forks
- ABI/schema-driven UI generation
- explicit security profile metadata surfaced at template level
- composable method-level configuration for app-specific workflows

## Suggested Next Phase
1. Add template dependency graph support for modular composition.
2. Add on-chain template attestation records for trust-minimized marketplace verification.
3. Add marketplace recommendation/ranking strategy with trust and usage weights.
4. Add batch import signed change-set and immutable rollback audit trail.
