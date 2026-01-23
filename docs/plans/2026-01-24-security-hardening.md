# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lock down MiniApp platform data access by enforcing RLS + service-role writes, tighten host CSP/iframe isolation, and harden admin/cron auth.

**Architecture:** Add Supabase RLS policies that allow public read where required but block direct writes (service role only). Update edge functions to perform authenticated writes via service-role clients and add ownership/admin checks where needed. Harden host app headers/iframe sandbox and postMessage routing to isolate MiniApps and reduce cross-origin exposure. Require explicit admin/cron secrets in production.

**Tech Stack:** Supabase SQL migrations, Deno Edge Functions, Next.js (middleware + headers), Jest (host-app).

### Task 1: Add RLS policies for MiniApp + community tables

**Files:**
- Create: `supabase/migrations/20260124000000_security_rls.sql`

**Step 1: Write the failing test**

Add a SQL sanity check file for local verification (no automated test harness exists yet):

```sql
-- tests/manual/rls_smoke.sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in (
  'miniapps','miniapp_stats','miniapp_stats_daily','miniapp_notifications','miniapp_tx_events',
  'miniapp_stats_rollup_log','social_comments','social_comment_votes','social_ratings','social_proof_of_interaction'
);
```

**Step 2: Run test to verify it fails**

Run: `psql "$SUPABASE_DB_URL" -f tests/manual/rls_smoke.sql`
Expected: tables show `rowsecurity = f` for at least some of the listed tables.

**Step 3: Write minimal implementation**

Create `supabase/migrations/20260124000000_security_rls.sql` with:

```sql
-- Enable RLS
alter table if exists miniapps enable row level security;
alter table if exists miniapp_stats enable row level security;
alter table if exists miniapp_stats_daily enable row level security;
alter table if exists miniapp_notifications enable row level security;
alter table if exists miniapp_tx_events enable row level security;
alter table if exists miniapp_stats_rollup_log enable row level security;
alter table if exists social_comments enable row level security;
alter table if exists social_comment_votes enable row level security;
alter table if exists social_ratings enable row level security;
alter table if exists social_proof_of_interaction enable row level security;

-- Public read where required
create policy "public_read_miniapps" on miniapps for select using (true);
create policy "public_read_miniapp_stats" on miniapp_stats for select using (true);
create policy "public_read_miniapp_stats_daily" on miniapp_stats_daily for select using (true);
create policy "public_read_miniapp_notifications" on miniapp_notifications for select using (true);
create policy "public_read_miniapp_tx_events" on miniapp_tx_events for select using (true);
create policy "public_read_social_comments" on social_comments for select using (true);
create policy "public_read_social_comment_votes" on social_comment_votes for select using (true);
create policy "public_read_social_ratings" on social_ratings for select using (true);

-- Service-role-only access for internal tables and all writes
create policy "service_role_all_miniapps" on miniapps for all to service_role using (true) with check (true);
create policy "service_role_all_miniapp_stats" on miniapp_stats for all to service_role using (true) with check (true);
create policy "service_role_all_miniapp_stats_daily" on miniapp_stats_daily for all to service_role using (true) with check (true);
create policy "service_role_all_miniapp_notifications" on miniapp_notifications for all to service_role using (true) with check (true);
create policy "service_role_all_miniapp_tx_events" on miniapp_tx_events for all to service_role using (true) with check (true);
create policy "service_role_all_miniapp_stats_rollup_log" on miniapp_stats_rollup_log for all to service_role using (true) with check (true);
create policy "service_role_all_social_comments" on social_comments for all to service_role using (true) with check (true);
create policy "service_role_all_social_comment_votes" on social_comment_votes for all to service_role using (true) with check (true);
create policy "service_role_all_social_ratings" on social_ratings for all to service_role using (true) with check (true);
create policy "service_role_all_social_proof" on social_proof_of_interaction for all to service_role using (true) with check (true);
```

**Step 4: Run test to verify it passes**

Run: `psql "$SUPABASE_DB_URL" -f tests/manual/rls_smoke.sql`
Expected: listed tables show `rowsecurity = t`.

**Step 5: Commit**

```bash
git add supabase/migrations/20260124000000_security_rls.sql tests/manual/rls_smoke.sql
git commit -m "security: enable RLS for miniapp and community tables"
```

### Task 2: Move Edge writes to service role + add ownership/admin checks

**Files:**
- Modify: `platform/edge/functions/send-notification/index.ts`
- Modify: `platform/edge/functions/social-comment-create/index.ts`
- Modify: `platform/edge/functions/social-comment-delete/index.ts`
- Modify: `platform/edge/functions/social-comment-vote/index.ts`
- Modify: `platform/edge/functions/social-rating-submit/index.ts`
- Modify: `platform/edge/functions/social-proof-verify/index.ts`
- Modify: `platform/edge/functions/_shared/apps.ts` (add owner check helper)
- Test: `platform/edge/functions/_shared/apps_test.ts`

**Step 1: Write the failing test**

```ts
// platform/edge/functions/_shared/apps_test.ts
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { isAppOwnerOrAdmin } from "./apps.ts";

Deno.test("isAppOwnerOrAdmin rejects non-owner", async () => {
  const supabase = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { developer_user_id: "dev" } }) }) }) }),
  } as any;
  const ok = await isAppOwnerOrAdmin(supabase, "app-1", "user-1");
  assertEquals(ok, false);
});
```

**Step 2: Run test to verify it fails**

Run: `cd platform/edge && deno test functions/_shared/apps_test.ts`
Expected: FAIL with "isAppOwnerOrAdmin is not a function".

**Step 3: Write minimal implementation**

- Add `isAppOwnerOrAdmin` helper to `platform/edge/functions/_shared/apps.ts` that:
  - looks up `developer_user_id` for `miniapps.app_id`
  - checks `admin_emails` for `auth.userId`
- Update `send-notification` to:
  - use `supabaseServiceClient()` for writes
  - require ownership/admin before insert
- Update social write endpoints to:
  - use `supabaseServiceClient()` for inserts/updates/upserts
  - replace `auth.user.id` with `auth.userId`

**Step 4: Run test to verify it passes**

Run: `cd platform/edge && deno test functions/_shared/apps_test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add platform/edge/functions/_shared/apps.ts platform/edge/functions/_shared/apps_test.ts \
  platform/edge/functions/send-notification/index.ts \
  platform/edge/functions/social-comment-create/index.ts \
  platform/edge/functions/social-comment-delete/index.ts \
  platform/edge/functions/social-comment-vote/index.ts \
  platform/edge/functions/social-rating-submit/index.ts \
  platform/edge/functions/social-proof-verify/index.ts
git commit -m "security: enforce service-role writes and app ownership"
```

### Task 3: Harden admin auth and cron endpoints

**Files:**
- Modify: `platform/host-app/lib/admin-auth.ts`
- Modify: `platform/host-app/pages/api/cron/automation-executor.ts`
- Modify: `platform/host-app/pages/api/cron/collect-miniapp-stats.ts`
- Modify: `platform/host-app/pages/api/cron/grow-stats.ts`
- Modify: `platform/host-app/pages/api/cron/init-stats.ts`
- Modify: `platform/host-app/pages/api/cron/rollup-stats.ts`
- Modify: `platform/host-app/pages/api/cron/sync-platform-stats.ts`
- Test: `platform/host-app/__tests__/lib/admin-auth.test.ts`

**Step 1: Write the failing test**

```ts
// platform/host-app/__tests__/lib/admin-auth.test.ts
import { requireAdmin } from "../../lib/admin-auth";

describe("requireAdmin", () => {
  it("ignores NEXT_PUBLIC admin keys", () => {
    process.env.NEXT_PUBLIC_ADMIN_API_KEY = "public";
    process.env.ADMIN_API_KEY = "";
    const result = requireAdmin({ authorization: "Bearer public" });
    expect(result.ok).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd platform/host-app && npm test -- admin-auth`
Expected: FAIL because NEXT_PUBLIC key is still accepted.

**Step 3: Write minimal implementation**

- Remove `NEXT_PUBLIC_ADMIN_*` sources from `resolveAdminKey`.
- Update cron endpoints to fail closed in production when `CRON_SECRET` is unset:
  - If `NODE_ENV !== "development"` and `CRON_SECRET` is missing: return 500.
  - Otherwise require `Authorization: Bearer <CRON_SECRET>`.

**Step 4: Run test to verify it passes**

Run: `cd platform/host-app && npm test -- admin-auth`
Expected: PASS.

**Step 5: Commit**

```bash
git add platform/host-app/lib/admin-auth.ts platform/host-app/pages/api/cron/*.ts \
  platform/host-app/__tests__/lib/admin-auth.test.ts
git commit -m "security: lock down admin keys and cron auth"
```

### Task 4: Tighten CSP, iframe sandbox, and postMessage routing

**Files:**
- Modify: `platform/host-app/next.config.js`
- Modify: `platform/host-app/pages/miniapps/[id].tsx`
- Modify: `platform/host-app/pages/launch/[id].tsx`
- Modify: `platform/host-app/lib/bridge/useBridgeListener.ts`
- Test: `platform/host-app/__tests__/pages/launch.[id].test.tsx`

**Step 1: Write the failing test**

Update the existing iframe sandbox expectation to remove `allow-same-origin`:

```ts
expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-popups");
```

**Step 2: Run test to verify it fails**

Run: `cd platform/host-app && npm test -- launch.[id]`
Expected: FAIL because sandbox still includes `allow-same-origin`.

**Step 3: Write minimal implementation**

- Replace `ContentSecurityPolicy` in `next.config.js` with a restrictive baseline (no `*`, no `unsafe-eval`).
- Update iframe sandbox attributes in `/miniapps/[id]` and `/launch/[id]` to remove `allow-same-origin`.
- Update `useBridgeListener` to:
  - ignore messages not originating from `iframeRef.current?.contentWindow`
  - reply using `event.origin` when non-null, otherwise `*`.

**Step 4: Run test to verify it passes**

Run: `cd platform/host-app && npm test -- launch.[id]`
Expected: PASS.

**Step 5: Commit**

```bash
git add platform/host-app/next.config.js \
  platform/host-app/pages/miniapps/[id].tsx \
  platform/host-app/pages/launch/[id].tsx \
  platform/host-app/lib/bridge/useBridgeListener.ts \
  platform/host-app/__tests__/pages/launch.[id].test.tsx
git commit -m "security: tighten CSP, iframe sandbox, and postMessage"
```
