# MiniApp Versioning Model

> **OS v2 Note (2026-03-30):** This versioning model remains current and
> compatible with MiniApp-OS v2. The manifest `permissions` field now includes
> OS service permissions (e.g. `storage`, `payment`, `game`, `checkin`, etc.)
> which are versioned alongside other manifest fields. Version snapshots
> capture the full manifest including OS service permission declarations.

This document defines the draft/published versioning workflow for the universal MiniApp platform.

## Goals

- Keep every miniapp change auditable and rollback-able.
- Support explicit lifecycle actions (`save_draft`, `publish`, `disable`, `rollback`).
- Keep one canonical runtime row in `miniapps` while storing immutable snapshots in version tables.

## New Tables

Migration: `migrations/053_miniapp_versions.sql`

1. `miniapp_versions`
   - Immutable snapshot per change.
   - Key fields:
     - `app_id`
     - `version_no` (monotonic per app)
     - `source_action` (`save_draft` / `publish` / `disable` / `rollback`)
     - `release_channel` (`draft` / `published`)
     - `status`
     - `manifest_hash`
     - `manifest`
     - `row_snapshot`
     - `actor`, `note`, `created_at`

2. `miniapp_releases`
   - Pointer table for current release heads.
   - One row per app:
     - `draft_version_id`
     - `published_version_id`

3. `miniapp_release_history`
   - Pointer movement timeline.
   - Tracks transitions by channel (`from_version_id` -> `to_version_id`) and action.

## Action Semantics

- `save_draft`
  - Runtime status resolves to `pending`.
  - Writes `miniapp_versions` with `release_channel = draft`.
  - Updates `miniapp_releases.draft_version_id`.

- `publish`
  - Runtime status resolves to `active`.
  - Writes `miniapp_versions` with `release_channel = published`.
  - Updates `miniapp_releases.published_version_id`.

- `disable`
  - Runtime status resolves to `disabled`.
  - Writes `miniapp_versions` with `release_channel = draft`.
  - Updates `miniapp_releases.draft_version_id`.

- `rollback`
  - Select target by `version_id` or `version_no`.
  - Re-applies target snapshot into `miniapps` through admin rollback endpoint.
  - Creates a new version entry (never mutates old versions).

## Admin APIs

Host app endpoints:

- `POST /api/miniapps/admin/upsert`
  - Persists `miniapps` row and version snapshot atomically at API level.
  - Response now includes `version` summary.

- `GET /api/miniapps/admin/versions?app_id=...&release_channel=...`
  - Lists version timeline and current release pointers.

- `POST /api/miniapps/admin/rollback`
  - Body:
    - `app_id` (required)
    - `version_id` or `version_no` (one required)
    - `release_channel` (`draft` or `published`)
    - `note` (optional)

- `GET /api/miniapps/admin/publish-requests`
  - Filters:
    - `app_id` (optional)
    - `status` (`all` / `pending` / `approved` / `rejected` / `applied` / `cancelled`)

- `POST /api/miniapps/admin/publish-requests`
  - Review actions:
    - `decision=approve` (apply publish)
    - `decision=reject`
    - `decision=cancel`
  - Body:
    - `request_id` (required)
    - `decision` (required)
    - `review_note` (optional)

Admin console proxy endpoints:

- `GET /api/miniapps/versions`
- `POST /api/miniapps/rollback`
- `GET /api/miniapps/publish-requests`
- `POST /api/miniapps/publish-requests`

## UI Integration

`platform/admin-console/src/app/miniapps/page.tsx`

- Detail panel now shows version history list.
- Supports channel filter (`all` / `published` / `draft`).
- Each version row has rollback action.
- Detail panel now includes publish request review queue (approve/reject).
- Edit flow supports explicit `Save & Publish` action.

## Approval Gate

- Enable publish approval gate by setting `MINIAPP_PUBLISH_APPROVAL_REQUIRED=true` on host-app.
- Optional reviewer allowlist:
  - `MINIAPP_PUBLISH_REVIEWERS=wallet1,wallet2,...`
  - if empty, falls back to `MINIAPP_ADMIN_WALLETS`
  - if both empty, reviewer check is permissive (for local/dev)
- Optional SLA settings:
  - `MINIAPP_PUBLISH_APPROVAL_SLA_MINUTES` (default: `60`)
  - `MINIAPP_PUBLISH_APPROVAL_ESCALATION_MINUTES` (default: `180`)
- Optional reminder webhook:
  - `MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL`
  - endpoint receives JSON payload with pending SLA-breach/escalated requests
- When enabled:
  - direct `publish` in upsert no longer publishes immediately;
  - system stores draft snapshot and creates pending publish request;
  - reviewer approval endpoint applies final publish.

### Admin Flow (Approval Mode)

1. Editor clicks `Save & Publish`.
2. Upsert returns `202` with `action=publish_requested`.
3. Reviewer opens Publish Requests panel in miniapp detail.
4. Reviewer chooses `Approve` / `Reject`.
5. On approve, host applies publish and records a new published version snapshot.

### Reminder Trigger

- Host API:
  - `POST /api/miniapps/admin/publish-reminders`
  - body: `{ "dry_run": true|false }`
- Admin proxy API:
  - `POST /api/miniapps/publish-requests/remind`
- Behavior:
  - scans pending requests;
  - computes `sla_breach` / `escalated`;
  - optionally posts reminder batch to webhook.
- Host cron endpoint:
  - `GET/POST /api/cron/miniapp-publish-reminders`
  - protected by `CRON_SECRET`
  - scheduled in `platform/host-app/vercel.json` (`*/15 * * * *`)

### Audit Export

- Admin proxy API:
  - `GET /api/miniapps/publish-requests/export?app_id=...&status=...`
- Returns CSV for operational review/auditing.

### Audit Verification API

- Host API:
  - `GET /api/miniapps/admin/publish-audit-verify?app_id=...&request_id=...&limit=...`
- Admin proxy API:
  - `GET /api/miniapps/publish-requests/verify-audit?app_id=...&request_id=...&limit=...`
- Output includes:
  - `ok`
  - `invalid_hash_events`
  - `chain_break_events`
  - sampled `issues`

### CLI Verification Scripts

- Env posture check:
  - `npm run validate:miniapp-env -- --target=all --stage=prod`
- Audit chain verify:
  - `npm run verify:publish-audit-chain`

## Immutable Approval Audit

- New migration:
  - `migrations/055_miniapp_publish_request_audit.sql`
- Audit table:
  - `miniapp_publish_request_audit`
- Chain model:
  - each row stores `prev_hash` + `chain_hash` (`sha256` over canonical event payload)
  - append-only events for:
    - request created
    - approved/rejected/cancelled
    - applied
    - reminder sent
- Additional governance rule:
  - requester wallet cannot approve their own request.

## Rollout Notes

1. Apply migration `053_miniapp_versions.sql` before enabling rollback in production.
2. Existing apps start versioning on first post-migration admin write.
3. Use backfill script to seed version `v1` for existing rows:
   - `npm run backfill:miniapp-versions -- --dry-run`
   - `npm run backfill:miniapp-versions`
   - optional filters:
     - `--app-id=miniapp-market`
     - `--limit=50`
