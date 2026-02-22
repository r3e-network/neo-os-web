# MiniApp Template Marketplace and No-Code Architecture

This document defines the next iteration for a template-first MiniApp platform where developers can launch an app by uploading JSON/YAML (or using a visual backend builder) without writing frontend code.

## Goals

- Frontend becomes fully template-driven and configuration-driven.
- Smart contracts are deployed from reusable contract templates with parameterized init payloads.
- Developers can publish frontend templates and contract templates to a marketplace.
- Builder UX should feel as easy as publishing an article.

## Current Baseline in This Repo

- Host runtime can already render MiniApps from `manifest.frontend_spec`, `page_template`, `detail_template`, and `operations`.
- Admin APIs already support `upsert`, `import-definitions`, `blueprints`, and version history.
- Factory contracts (`MiniAppFactory`, `MiniAppFactoryV2`) already support template registration and deployment.
- New backend endpoints now expose schema/catalog and definition preview capabilities.

## Proposed End-State

### 1) Frontend Templates (No-Code)

- Every app definition references a frontend template ID + template params.
- Host renderer resolves template by ID and binds app data into blocks/layout.
- JSON/YAML fields drive:
  - app metadata (name, name_zh, description, description_zh)
  - media assets (logo/banner + variants)
  - page structure (tabs, blocks, operation panel)
  - integrations (reviews, news, activity)

### 2) Contract Templates (Parameterized)

- Each app references `contract_template.template_id` and `init_params`.
- Deployment path:
  1. Validate params against template schema (backend + optional on-chain sanity checks)
  2. Deploy via `MiniAppFactoryV2.DeployFromTemplate`
  3. Register app + manifest hash in registry
- Template metadata includes:
  - allowed operations
  - permission profile
  - risk profile and required capabilities (oracle/randomness/cross-chain)

### 3) Template Marketplace

- Two template classes:
  - frontend templates
  - contract templates
- Template cards should include:
  - template ID, version, owner, tags, category
  - compatibility matrix (host runtime versions)
  - audit status and verification badge
  - usage counts and ratings

## Banner and Logo Strategy

Use a deterministic + variant-aware strategy:

- Primary fields:
  - `media.logo`
  - `media.banner`
- Variant fields:
  - `media.logo_variants[]`
  - `media.banner_variants[]`
- Variant selector dimensions:
  - theme: `light|dark|any`
  - density: `1x|2x|3x`
  - locale: e.g. `en`, `zh-CN`
- Runtime selection order:
  1. explicit `logo_url`/`banner_url`
  2. first matching variant
  3. primary media URL
  4. convention fallback (`/miniapp-assets/{slug}/logo.jpg`, `/miniapp-assets/{slug}/banner.jpg`)

## Smart Contract Template Design Principles

Based on current ecosystem best practice (modular proxy/factory patterns, strict role boundaries, and schema-first configuration):

- Keep templates minimal and composable.
- Put variable behavior into strongly validated init params.
- Isolate privileged operations behind explicit roles.
- Emit structured events for indexers and analytics.
- Standardize pause/upgrade patterns and risk switches.
- Require deterministic schema hash tracking for each deployed app.

## Recommended Near-Term Milestones

1. **Schema hardening**
   - Keep JSON Schema as source-of-truth.
   - Add CI validation for all definitions (JSON + YAML).

2. **Visual builder backed by APIs**
   - Build admin page that consumes:
     - `/api/miniapps/admin/schema`
     - `/api/miniapps/admin/template-catalog`
     - `/api/miniapps/admin/definition-preview`
     - `/api/miniapps/admin/upsert`

3. **Template storage model**
   - Add DB tables for frontend/contract template catalogs with versioning and ownership.

4. **Factory integration loop**
   - Connect backend deployment flow to `MiniAppFactoryV2` template IDs and schema validation.

5. **Marketplace UX**
   - Template browsing, publish, version diff, rating, and trust badges.

## Security and Governance Notes

- Treat uploaded definitions as untrusted input.
- Validate against schema before any persistence.
- Enforce strict URL policies for media and docs links.
- Keep publish approval workflow for high-impact apps/templates.
- Store immutable version snapshots for audit and rollback.

## What Was Added in This Iteration

- YAML definition parsing support in definition loader.
- Schema validator utility used by import pipeline.
- Admin API endpoints for schema, template catalog, and definition preview.
- Developer page upgraded toward a no-code/template-builder workflow.
- Media variant-aware fallback handling in runtime card assets.
- Example YAML definition demonstrating template marketplace metadata.
