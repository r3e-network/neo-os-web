# MiniApp Production Cutover Checklist

This checklist covers production rollout for MiniApp approval gate, versioning, reminders, and audit chain.

## 1) Required migrations

Apply in order:

1. `053_miniapp_versions.sql`
2. `054_miniapp_publish_requests.sql`
3. `055_miniapp_publish_request_audit.sql`

## 2) Host-app required env vars

Core admin:

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
- `MINIAPP_ADMIN_API_KEY` (recommended)
- `MINIAPP_ADMIN_WALLETS` (comma-separated wallet allowlist)

Approval gate:

- `MINIAPP_PUBLISH_APPROVAL_REQUIRED=true`
- `MINIAPP_PUBLISH_REVIEWERS=wallet1,wallet2,...` (recommended)

SLA / escalation:

- `MINIAPP_PUBLISH_APPROVAL_SLA_MINUTES=60`
- `MINIAPP_PUBLISH_APPROVAL_ESCALATION_MINUTES=180`

Reminder / cron:

- `MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL=https://...` (optional, but recommended)
- `CRON_SECRET=<strong-random-secret>`
- `HOST_APP_BASE_URL=https://your-host-app-domain`

## 3) Admin-console required env vars

- `ADMIN_CONSOLE_API_KEY`
- `MINIAPP_HOST_APP_BASE_URL=https://your-host-app-domain`

## 4) Cutover sequence

1. Deploy migrations.
2. Deploy host-app with approval gate + reminder endpoints.
3. Deploy admin-console with publish request review UI.
4. Run initial backfill:
   - `npm run backfill:miniapp-versions -- --dry-run`
   - `npm run backfill:miniapp-versions`
5. Validate env posture:
   - `npm run validate:miniapp-env -- --target=all --stage=prod`
5. Verify audit chain integrity:
   - `npm run verify:publish-audit-chain`

## 5) Rollback plan

If publish flow misbehaves:

1. Set `MINIAPP_PUBLISH_APPROVAL_REQUIRED=false` (temporary bypass).
2. Keep versioning tables enabled (do not drop).
3. Keep audit writes enabled for traceability.
4. Re-run regression tests and recover approval gate after fix.

## 6) Post-cutover verification

1. `Save & Publish` returns pending request (`202`) when gate enabled.
2. Reviewer can approve/reject in admin-console.
3. Approved request updates `miniapps` status to `active`.
4. Version history includes publish/apply snapshots.
5. Reminder dry-run returns expected breached/escalated requests.
6. CSV export for publish requests downloads correctly.
7. Audit chain verification reports `ok: true`.
8. Cron reminder endpoint executes with `CRON_SECRET` and reports success.

## 7) Quick commands

- Env validation (prod):
  - `npm run validate:miniapp-env -- --target=all --stage=prod`
- Env validation (json output):
  - `npm run validate:miniapp-env -- --target=host --stage=prod --json`
- Audit verify:
  - `npm run verify:publish-audit-chain`
- Audit verify scoped to app:
  - `npm run verify:publish-audit-chain -- --app-id=miniapp-market`
