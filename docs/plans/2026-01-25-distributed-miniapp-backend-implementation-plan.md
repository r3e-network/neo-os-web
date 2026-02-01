# Distributed MiniApp Backend Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the distributed MiniApp backend with manual publish flow, consistent schema, and a unified registry view.

**Architecture:** Use `miniapp_submissions` + `miniapp_internal` as canonical sources and expose `miniapp_registry_view` for discovery. External submissions are manually published by admins via CDN + `miniapp-publish` with strict validation. Internal apps remain prebuilt.

**Tech Stack:** Supabase SQL migrations, Deno Edge Functions (TypeScript), Next.js admin console (React), Vitest.

---

### Task 1: Add manual publish fields migration (external submissions)

**Files:**
- Create: `supabase/migrations/20260125000001_add_manual_publish_fields.sql`
- Create: `platform/edge/functions/__tests__/miniapp-submissions-migration.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.resolve(__dirname, "../../../../supabase/migrations/20260125000001_add_manual_publish_fields.sql"),
  "utf8",
);

describe("miniapp submissions manual publish migration", () => {
  it("adds manual publish columns", () => {
    expect(sql).toContain("entry_url");
    expect(sql).toContain("assets_selected");
    expect(sql).toContain("build_started_at");
    expect(sql).toContain("build_mode");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-submissions-migration.test.ts`
Expected: FAIL (ENOENT: migration file missing).

**Step 3: Write minimal implementation**

```sql
-- Add manual publish fields for external submissions
ALTER TABLE public.miniapp_submissions
  ADD COLUMN IF NOT EXISTS entry_url TEXT,
  ADD COLUMN IF NOT EXISTS assets_selected JSONB,
  ADD COLUMN IF NOT EXISTS build_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS build_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (build_mode IN ('manual', 'platform'));
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-submissions-migration.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260125000001_add_manual_publish_fields.sql \
  platform/edge/functions/__tests__/miniapp-submissions-migration.test.ts
git commit -m "db: add manual publish fields to miniapp submissions"
```

---

### Task 2: Update unified registry view (internal + external)

**Files:**
- Modify: `platform/edge/functions/__tests__/miniapp-registry-view.test.ts`
- Create: `supabase/migrations/20260125000002_update_miniapp_registry_view.sql`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(
  path.resolve(__dirname, "../../../../supabase/migrations/20260125000002_update_miniapp_registry_view.sql"),
  "utf8",
);

describe("miniapp registry view", () => {
  it("unions internal apps", () => {
    expect(sql.includes("miniapp_internal")).toBe(true);
  });

  it("prefers assets_selected", () => {
    expect(sql).toContain("assets_selected");
  });

  it("uses entry_url for external apps", () => {
    expect(sql).toContain("entry_url");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-registry-view.test.ts`
Expected: FAIL (ENOENT: migration file missing).

**Step 3: Write minimal implementation**

```sql
CREATE OR REPLACE VIEW miniapp_registry_view AS
SELECT
  'external'::text as source_type,
  id,
  app_id,
  manifest,
  manifest_hash,
  COALESCE(entry_url, cdn_base_url) as entry_url,
  COALESCE(
    (assets_selected->>'icon'),
    (assets_detected->>'icon'),
    (build_config->>'icon_url'),
    manifest->>'icon'
  ) as icon_url,
  COALESCE(
    (assets_selected->>'banner'),
    (assets_detected->>'banner'),
    (build_config->>'banner_url'),
    manifest->>'banner'
  ) as banner_url,
  status,
  current_version as version,
  manifest->>'name' as name,
  manifest->>'name_zh' as name_zh,
  manifest->>'description' as description,
  manifest->>'description_zh' as description_zh,
  manifest->>'category' as category,
  updated_at,
  created_at
FROM miniapp_submissions
WHERE status = 'published'

UNION ALL

SELECT
  'internal'::text as source_type,
  id,
  app_id,
  manifest,
  manifest_hash,
  entry_url,
  icon_url,
  banner_url,
  status,
  current_version as version,
  manifest->>'name' as name,
  manifest->>'name_zh' as name_zh,
  manifest->>'description' as description,
  manifest->>'description_zh' as description_zh,
  category,
  updated_at,
  created_at
FROM miniapp_internal
WHERE status = 'active';
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-registry-view.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260125000002_update_miniapp_registry_view.sql \
  platform/edge/functions/__tests__/miniapp-registry-view.test.ts
git commit -m "db: update registry view for internal/external apps"
```

---

### Task 3: Publish URL validation helper + edge publish flow

**Files:**
- Create: `platform/edge/functions/_shared/miniapps/publish-validation.ts`
- Create: `platform/edge/functions/__tests__/miniapp-publish-validation.test.ts`
- Modify: `platform/edge/functions/miniapp-publish/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { validatePublishPayload } from "../_shared/miniapps/publish-validation";

const base = "https://cdn.example.com";

describe("publish validation", () => {
  it("accepts https entry_url", () => {
    const result = validatePublishPayload({
      entryUrl: "https://cdn.example.com/app/index.html",
      cdnBaseUrl: base,
      assets: { icon: "https://cdn.example.com/app/icon.png" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects non-https urls", () => {
    const result = validatePublishPayload({
      entryUrl: "http://cdn.example.com/app/index.html",
      cdnBaseUrl: base,
      assets: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects urls outside cdn base", () => {
    const result = validatePublishPayload({
      entryUrl: "https://evil.com/app/index.html",
      cdnBaseUrl: base,
      assets: {},
    });
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-publish-validation.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**

```ts
type PublishAssets = { icon?: string; banner?: string };

type PublishValidationInput = {
  entryUrl: string;
  cdnBaseUrl?: string | null;
  assets?: PublishAssets | null;
};

type PublishValidationResult = { valid: boolean; errors: string[] };

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUnderBase(value: string, base?: string | null): boolean {
  if (!base) return true;
  try {
    const url = new URL(value);
    const baseUrl = new URL(base);
    return url.origin === baseUrl.origin && url.pathname.startsWith(baseUrl.pathname);
  } catch {
    return false;
  }
}

export function validatePublishPayload(input: PublishValidationInput): PublishValidationResult {
  const errors: string[] = [];
  if (!input.entryUrl || !isHttpsUrl(input.entryUrl)) {
    errors.push("entry_url must be an https URL");
  } else if (!isUnderBase(input.entryUrl, input.cdnBaseUrl)) {
    errors.push("entry_url must be under CDN_BASE_URL");
  }

  const assets = input.assets || {};
  for (const value of [assets.icon, assets.banner]) {
    if (!value) continue;
    if (!isHttpsUrl(value)) errors.push("assets_selected must be https URLs");
    else if (!isUnderBase(value, input.cdnBaseUrl)) errors.push("assets_selected must be under CDN_BASE_URL");
  }

  return { valid: errors.length === 0, errors };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-publish-validation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/edge/functions/_shared/miniapps/publish-validation.ts \
  platform/edge/functions/__tests__/miniapp-publish-validation.test.ts

git commit -m "edge: add publish URL validation helper"
```

---

### Task 4: Apply publish validation + entry_url storage

**Files:**
- Modify: `platform/edge/functions/miniapp-publish/index.ts`
- Create: `platform/edge/functions/__tests__/miniapp-publish-entry-url.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../miniapp-publish/index.ts"),
  "utf8",
);

describe("miniapp-publish entry_url", () => {
  it("writes entry_url to submissions", () => {
    expect(source).toContain("entry_url");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-publish-entry-url.test.ts`
Expected: FAIL (entry_url not written yet).

**Step 3: Write minimal implementation**

```ts
import { validatePublishPayload } from "../_shared/miniapps/publish-validation.ts";

// interface update near top
// entry_url is required for publish
interface PublishRequest {
  submission_id: string;
  entry_url: string;
  cdn_base_url?: string;
  cdn_version_path?: string;
  assets?: { icon?: string; banner?: string };
  assets_selected?: { icon?: string; banner?: string };
  build_log?: string;
}

// ...inside handler after body parsing
if (!body.entry_url) return validationError("entry_url", "entry_url is required", req);

const validation = validatePublishPayload({
  entryUrl: body.entry_url,
  cdnBaseUrl: body.cdn_base_url ?? null,
  assets: body.assets_selected ?? body.assets ?? null,
});

if (!validation.valid) {
  return errorResponse("VAL_011", { message: validation.errors.join("; ") }, req);
}

// update submission
await supabase
  .from("miniapp_submissions")
  .update({
    status: "published",
    entry_url: body.entry_url,
    cdn_base_url: body.cdn_base_url ?? null,
    cdn_version_path: versionPath,
    assets_selected: assets,
    built_at: new Date().toISOString(),
    built_by: null,
    build_log: body.build_log ?? null,
  })
  .eq("id", body.submission_id);
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-publish-entry-url.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/edge/functions/miniapp-publish/index.ts \
  platform/edge/functions/__tests__/miniapp-publish-entry-url.test.ts

git commit -m "edge: store entry_url on miniapp publish"
```

---

### Task 5: Submission payload helper (manifest_hash + build_mode)

**Files:**
- Create: `platform/edge/functions/_shared/miniapps/submissions.ts`
- Create: `platform/edge/functions/__tests__/miniapp-submission-payload.test.ts`
- Modify: `platform/edge/functions/miniapp-submit/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildSubmissionPayload } from "../_shared/miniapps/submissions";

const base = {
  gitUrl: "https://github.com/example/repo",
  gitInfo: { host: "github.com", owner: "example", name: "repo" },
  branch: "main",
  subfolder: "",
  commitInfo: { sha: "abc", message: "msg", author: "me", date: "now" },
  appId: "app-1",
  manifest: { app_id: "app-1" },
  manifestHash: "hash",
  assets: {},
  buildConfig: {},
};

describe("submission payload", () => {
  it("uses manifest_hash and build_mode", () => {
    const payload = buildSubmissionPayload({
      ...base,
      autoApproved: true,
    });
    expect(payload).toHaveProperty("manifest_hash", "hash");
    expect(payload).toHaveProperty("build_mode", "platform");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-submission-payload.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**

```ts
export function buildSubmissionPayload(input: {
  gitUrl: string;
  gitInfo: { host: string; owner: string; name: string };
  branch: string;
  subfolder?: string;
  commitInfo: { sha: string; message: string; author: string; date: string };
  appId: string;
  manifest: Record<string, unknown>;
  manifestHash: string;
  assets: Record<string, unknown>;
  buildConfig: Record<string, unknown>;
  autoApproved: boolean;
  submittedBy?: string | null;
}): Record<string, unknown> {
  const buildMode = input.autoApproved ? "platform" : "manual";
  return {
    git_url: input.gitUrl,
    git_host: input.gitInfo.host,
    repo_owner: input.gitInfo.owner,
    repo_name: input.gitInfo.name,
    subfolder: input.subfolder || null,
    branch: input.branch,
    git_commit_sha: input.commitInfo.sha,
    git_commit_message: input.commitInfo.message,
    git_committer: input.commitInfo.author,
    git_committed_at: input.commitInfo.date,
    app_id: input.appId,
    manifest: input.manifest,
    manifest_hash: input.manifestHash,
    assets_detected: input.assets,
    build_config: input.buildConfig,
    status: input.autoApproved ? "building" : "pending_review",
    build_mode: buildMode,
    submitted_by: input.submittedBy ?? null,
  };
}
```

```ts
// miniapp-submit/index.ts wiring
import { buildSubmissionPayload } from "../_shared/miniapps/submissions.ts";

const payload = buildSubmissionPayload({
  gitUrl: normalizedUrl,
  gitInfo,
  branch,
  subfolder,
  commitInfo,
  appId,
  manifest,
  manifestHash,
  assets,
  buildConfig,
  autoApproved,
  submittedBy: auth?.userId ?? null,
});

const { data: submission, error: insertError } = await supabase
  .from("miniapp_submissions")
  .insert(payload)
  .select("id")
  .single();
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-submission-payload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/edge/functions/_shared/miniapps/submissions.ts \
  platform/edge/functions/__tests__/miniapp-submission-payload.test.ts \
  platform/edge/functions/miniapp-submit/index.ts

git commit -m "edge: standardize submission payload fields"
```

---

### Task 6: Build mode gating + approval audit insert

**Files:**
- Create: `platform/edge/functions/_shared/miniapps/build-mode.ts`
- Create: `platform/edge/functions/__tests__/miniapp-build-mode.test.ts`
- Modify: `platform/edge/functions/miniapp-build/index.ts`
- Modify: `platform/edge/functions/miniapp-approve/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { canTriggerBuild } from "../_shared/miniapps/build-mode";

describe("build mode", () => {
  it("blocks manual submissions", () => {
    expect(canTriggerBuild("manual")).toBe(false);
  });

  it("allows platform submissions", () => {
    expect(canTriggerBuild("platform")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-build-mode.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**

```ts
export function canTriggerBuild(mode?: string | null): boolean {
  return String(mode ?? "manual").toLowerCase() === "platform";
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-build-mode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/edge/functions/_shared/miniapps/build-mode.ts \
  platform/edge/functions/__tests__/miniapp-build-mode.test.ts

git commit -m "edge: add build mode gate"
```

---

### Task 7: Wire build mode gate + approval audit

**Files:**
- Modify: `platform/edge/functions/miniapp-build/index.ts`
- Modify: `platform/edge/functions/miniapp-approve/index.ts`
- Create: `platform/edge/functions/__tests__/miniapp-build-approve-wiring.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const buildSource = fs.readFileSync(
  path.resolve(__dirname, "../miniapp-build/index.ts"),
  "utf8",
);
const approveSource = fs.readFileSync(
  path.resolve(__dirname, "../miniapp-approve/index.ts"),
  "utf8",
);

describe("miniapp build/approve wiring", () => {
  it("checks build_mode in miniapp-build", () => {
    expect(buildSource).toContain("build_mode");
  });

  it("writes miniapp_approval_audit", () => {
    expect(approveSource).toContain("miniapp_approval_audit");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-build-approve-wiring.test.ts`
Expected: FAIL (test file missing).

**Step 3: Write minimal implementation**

```ts
// miniapp-build/index.ts
import { canTriggerBuild } from "../_shared/miniapps/build-mode.ts";

if (!canTriggerBuild(submission.build_mode)) {
  return errorResponse("VAL_011", { message: "Submission build_mode is manual" }, req);
}

// miniapp-approve/index.ts
await supabase.from("miniapp_approval_audit").insert({
  submission_id: submission.id,
  app_id: submission.app_id,
  action: body.action,
  previous_status: submission.status,
  new_status: updateData.status,
  reviewer_id: auth.userId,
  review_notes: sanitizedNotes ?? null,
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run platform/edge/functions/__tests__/miniapp-build-approve-wiring.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/edge/functions/miniapp-build/index.ts \
  platform/edge/functions/miniapp-approve/index.ts \
  platform/edge/functions/__tests__/miniapp-build-approve-wiring.test.ts

git commit -m "edge: gate builds by build_mode and log audits"
```

---

### Task 8: Admin console manual publish route

**Files:**
- Create: `platform/admin-console/src/app/api/admin/miniapps/publish/route.ts`
- Create: `platform/admin-console/src/lib/__tests__/publish-api.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "../../app/api/admin/miniapps/publish/route";

vi.mock("../admin-auth", () => ({
  requireAdminAuth: () => null,
}));

vi.mock("../api-client", () => ({
  edgeClient: { post: vi.fn().mockResolvedValue({ success: true }) },
}));

describe("admin publish API", () => {
  it("requires submission_id", async () => {
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd platform/admin-console && npm run test -- publish-api.test.ts`
Expected: FAIL (route missing).

**Step 3: Write minimal implementation**

```ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { edgeClient } from "@/lib/api-client";

const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_EDGE_URL || "https://edge.localhost";

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const body = await req.json();
  if (!body.submission_id || !body.entry_url) {
    return NextResponse.json({ error: "submission_id and entry_url required" }, { status: 400 });
  }

  const result = await edgeClient.post(`${EDGE_FUNCTION_URL}/functions/v1/miniapp-publish`, body);
  return NextResponse.json(result);
}
```

**Step 4: Run test to verify it passes**

Run: `cd platform/admin-console && npm run test -- publish-api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/admin-console/src/app/api/admin/miniapps/publish/route.ts \
  platform/admin-console/src/lib/__tests__/publish-api.test.ts

git commit -m "admin: add manual publish API proxy"
```

---

### Task 9: Admin console publish UI (replace build trigger)

**Files:**
- Modify: `platform/admin-console/src/components/admin/miniapps/submission-card.tsx`
- Replace: `platform/admin-console/src/components/admin/miniapps/build-trigger.tsx` (rename to publish)
- Create: `platform/admin-console/src/components/admin/miniapps/__tests__/publish-trigger.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublishTrigger } from "../publish-trigger";

describe("PublishTrigger", () => {
  it("renders entry url input", () => {
    render(<PublishTrigger submissionId="id" />);
    expect(screen.getByLabelText(/Entry URL/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd platform/admin-console && npm run test -- publish-trigger.test.tsx`
Expected: FAIL (component missing).

**Step 3: Write minimal implementation**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PublishTrigger({ submissionId, onSuccess }: PublishTriggerProps) {
  const [entryUrl, setEntryUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePublish = async () => {
    if (!entryUrl) {
      setError("Entry URL is required");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload = {
      submission_id: submissionId,
      entry_url: entryUrl,
      assets_selected: {
        ...(iconUrl ? { icon: iconUrl } : {}),
        ...(bannerUrl ? { banner: bannerUrl } : {}),
      },
    };

    try {
      const response = await fetch("/api/admin/miniapps/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details || "Publish failed");
      setSuccess("Published");
      setTimeout(() => onSuccess?.(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-500">Entry URL</label>
      <Input value={entryUrl} onChange={(e) => setEntryUrl(e.target.value)} aria-label="Entry URL" />
      <label className="text-xs text-gray-500">Icon URL (optional)</label>
      <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} aria-label="Icon URL" />
      <label className="text-xs text-gray-500">Banner URL (optional)</label>
      <Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} aria-label="Banner URL" />
      <Button size="sm" onClick={handlePublish} disabled={loading}>
        {loading ? "Publishing..." : "Publish"}
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
    </div>
  );
}
```

```tsx
// submission-card.tsx wiring
import { PublishTrigger } from "./publish-trigger";

const canPublish = submission.status === "approved";

{canPublish && <PublishTrigger submissionId={submission.id} onSuccess={onRefresh} />}
```

**Step 4: Run test to verify it passes**

Run: `cd platform/admin-console && npm run test -- publish-trigger.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/admin-console/src/components/admin/miniapps/submission-card.tsx \
  platform/admin-console/src/components/admin/miniapps/publish-trigger.tsx \
  platform/admin-console/src/components/admin/miniapps/__tests__/publish-trigger.test.tsx

git commit -m "admin: add publish UI for manual builds"
```

---

### Task 10: Documentation for manual publish

**Files:**
- Modify: `platform/docs/distributed-miniapps-guide.md`
- Modify: `platform/docs/distributed-miniapps-deployment-checklist.md`
- Create: `docs/__tests__/distributed-miniapps-guide.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const guide = fs.readFileSync(
  path.resolve(__dirname, "../../platform/docs/distributed-miniapps-guide.md"),
  "utf8",
);

describe("distributed miniapps guide", () => {
  it("documents manual publish", () => {
    expect(guide).toContain("miniapp-publish");
    expect(guide).toContain("entry_url");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run docs/__tests__/distributed-miniapps-guide.test.ts`
Expected: FAIL (doc does not mention manual publish fields).

**Step 3: Write minimal implementation**

```md
### 4. Admin Manual Publish

Admin builds locally and uploads artifacts to CDN, then calls:

POST /functions/v1/miniapp-publish
{
  "submission_id": "uuid",
  "entry_url": "https://cdn.example.com/miniapps/app-id/version/index.html",
  "assets_selected": {
    "icon": "https://cdn.example.com/miniapps/app-id/assets/icon.png",
    "banner": "https://cdn.example.com/miniapps/app-id/assets/banner.jpg"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run docs/__tests__/distributed-miniapps-guide.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add platform/docs/distributed-miniapps-guide.md \
  platform/docs/distributed-miniapps-deployment-checklist.md \
  docs/__tests__/distributed-miniapps-guide.test.ts

git commit -m "docs: document manual miniapp publish flow"
```

---

## Notes
- After migrations, run Supabase CLI migrations or SQL editor as appropriate.
- Keep `supabase/migrations` canonical; only update `platform/supabase` via export if needed.
