# MiniApp Platform Code Review (Automated Scan)

Scope scanned (per request):
- `platform/host-app`
- `platform/admin-console`
- `platform/sdk`
- `platform/edge`
- `platform/builtin-app`
- `services/`
- `infrastructure/`
- `contracts/`

Notes:
- This review is primarily a repo-wide, pattern-based scan; it will include some false positives (especially for words like “placeholder”, “mock”, and “temp” in UI copy/docs).
- All findings include `file:line` references. Exhaustive match lists are stored alongside this report in `reports/miniapp_review/`.
- Common excludes used for searches: `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `*.min.*`, `package-lock.json`, `*.tsbuildinfo`.

---

## 1) PLACEHOLDERS

### High-signal findings
- Placeholder Supabase URL/key used to construct a client when env vars are missing:
  - `platform/host-app/lib/supabase.ts:14`
  - `platform/host-app/lib/supabase.ts:15`
  - `platform/host-app/lib/supabase.ts:16`
- TODO left in interactive UX flow:
  - `platform/host-app/pages/launch/[id].tsx:237`
- Admin console UI marked as placeholder (unfinished product surface):
  - `platform/admin-console/src/app/contracts/page.tsx:67`
  - `platform/admin-console/src/app/analytics/page.tsx:73`

### Mock/stub code included in non-test packages (possible “prod” inclusion)
- In-memory mock repository lives in a normal package file (not `_test.go`, no build tags):
  - `infrastructure/database/mock_repository.go:1`
  - `infrastructure/database/mock_repository.go:8`
  - `infrastructure/database/mock_repository.go:25`

### Exhaustive lists
- All placeholder-related matches: `reports/miniapp_review/placeholders.txt`
- Non-test / non-doc filtered subset: `reports/miniapp_review/placeholders_prod.txt`

---

## 2) NON-PRODUCTION READY CODE

### Hardcoded credentials / secrets (pattern scan)
No obvious hardcoded keys were found by the automated regex checks, but review these “near misses”:
- Authorization header is built by concatenation (not a hardcoded secret, but worth sanity-checking):
  - `services/conforacle/marble/handlers.go:72`
- Token strings in tests (safe if not reused elsewhere):
  - `platform/host-app/__tests__/hooks/useCommunity.test.ts:147`
  - `platform/host-app/__tests__/hooks/useCommunity.test.ts:175`

Exhaustive list: `reports/miniapp_review/hardcoded_secrets_suspects.txt`

### Console logging in non-test code
Direct `console.*` usage in runtime code (not behind a logger abstraction):
- `platform/edge/functions/miniapp-stats/index.ts:119`
- `platform/edge/functions/miniapp-stats/index.ts:131`
- `platform/edge/functions/_shared/apps.ts:105`
- `platform/edge/functions/_shared/apps.ts:126`
- `platform/edge/functions/market-trending/index.ts:96`
- `platform/edge/functions/market-trending/index.ts:214`
- `platform/edge/functions/_shared/k8s-config.ts:96`
- `platform/edge/functions/_shared/k8s-config.ts:97`
- `platform/edge/functions/_shared/k8s-config.ts:98`
- `platform/edge/functions/_shared/tee.ts:10`
- `platform/edge/functions/_shared/tee.ts:26`
- `platform/admin-console/src/app/api/analytics/route.ts:104`

Host app’s logger wrapper itself uses `console.*` (arguably acceptable, but still “console in prod”):
- `platform/host-app/lib/logger.ts:12`
- `platform/host-app/lib/logger.ts:18`
- `platform/host-app/lib/logger.ts:23`
- `platform/host-app/lib/logger.ts:27`

Exhaustive list: `reports/miniapp_review/console_usage.txt`  
Non-test / non-example filtered subset: `reports/miniapp_review/console_usage_prod.txt`

### Disabled security features / insecure-mode toggles
Insecure mode toggle exists; enforcement is present (dev/test only), but still worth auditing:
- `infrastructure/database/supabase_client.go:49`
- `infrastructure/database/supabase_client.go:50`
- `infrastructure/database/supabase_client.go:79`

Exhaustive list: `reports/miniapp_review/security_disabled_suspects.txt`

### Missing / inconsistent error handling
Admin console analytics route does not consistently check upstream response status (some `.ok` checks exist, many don’t):
- `platform/admin-console/src/app/api/analytics/route.ts:13`
- `platform/admin-console/src/app/api/analytics/route.ts:24`
- `platform/admin-console/src/app/api/analytics/route.ts:36`
- `platform/admin-console/src/app/api/analytics/route.ts:63`

Host app launch page explicitly swallows cross-origin errors:
- `platform/host-app/pages/launch/[id].tsx:212`
- `platform/host-app/pages/launch/[id].tsx:213`

(The repo-wide “empty catch / swallow” regex did not find additional instances; see `reports/miniapp_review/missing_error_handling_suspects.txt`.)

### Hardcoded localhost / local domains in non-test code
Localhost / local-only defaults exist in runtime code paths (some are explicitly “dev fallback”):
- `infrastructure/database/supabase_client.go:61`
- `infrastructure/database/supabase_client.go:83`
- `platform/edge/functions/_shared/k8s-config.ts:62`
- `platform/edge/functions/_shared/k8s-config.ts:64`
- `platform/edge/functions/_shared/k8s-config.ts:65`
- `platform/edge/functions/_shared/k8s-config.ts:66`
- `platform/edge/functions/_shared/k8s-config.ts:67`
- `platform/edge/functions/_shared/k8s-config.ts:68`
- `platform/edge/functions/_shared/k8s-config.ts:69`
- `platform/edge/functions/_shared/k8s-config.ts:70`

Admin console defaults to `.localhost` when env vars are missing:
- `platform/admin-console/src/lib/api-client.ts:8`
- `platform/admin-console/src/lib/api-client.ts:9`
- `platform/admin-console/src/app/api/analytics/route.ts:7`

Exhaustive list: `reports/miniapp_review/hardcoded_localhost_urls.txt`  
Non-test / non-doc filtered subset: `reports/miniapp_review/hardcoded_localhost_urls_prod.txt`

### Commented-out code blocks
Commented-out example implementations live in non-test code:
- `infrastructure/chain/base_contract.go:23`
- `infrastructure/chain/base_contract.go:24`
- `infrastructure/chain/base_contract.go:29`
- `infrastructure/chain/base_contract.go:30`
- `infrastructure/chain/base_contract.go:152`
- `infrastructure/chain/base_contract.go:153`
- `infrastructure/chain/base_contract.go:154`
- `infrastructure/chain/base_contract.go:155`
- `infrastructure/database/generic_repository.go:23`
- `infrastructure/database/generic_repository.go:24`
- `infrastructure/database/generic_repository.go:25`

Exhaustive list (strict heuristic): `reports/miniapp_review/commented_out_code_blocks_strict.txt`

### TypeScript `any` usage
`any` is used broadly (including runtime code) instead of `unknown` + validation / narrow typing:
- `platform/host-app/lib/miniapp-sdk.ts:219`
- `platform/host-app/pages/launch/[id].tsx:398`
- `platform/edge/functions/_shared/events.ts:115`
- `platform/edge/functions/_shared/supabase.ts:118`
- `platform/edge/functions/market-trending/index.ts:91`

Exhaustive list: `reports/miniapp_review/typescript_any.txt`  
Non-test / non-example filtered subset: `reports/miniapp_review/typescript_any_prod.txt`

### Debug flags left enabled
Debug toggle is wired to `process.env.DEBUG`:
- `platform/host-app/lib/logger.ts:7`

Exhaustive list: `reports/miniapp_review/debug_flags.txt`

### Potential secret exposure risk (design/usage)
Client helper includes a “service role” request path (currently only referenced in tests, but present in shared lib):
- `platform/admin-console/src/lib/api-client.ts:66`
- `platform/admin-console/src/lib/api-client.ts:70`
- `platform/admin-console/src/lib/api-client.ts:71`

---

## 3) INCONSISTENCIES

### Error response formats differ across surfaces
Edge functions standardize on `{ error: { code, message } }`:
- `platform/edge/functions/_shared/response.ts:9`
- `platform/edge/functions/_shared/response.ts:10`

Host app has a helper that matches the edge format:
- `platform/host-app/lib/api-response.ts:31`
- `platform/host-app/lib/api-response.ts:68`

But host app RPC routes return other shapes (`{ error: string }` and sometimes top-level `code`):
- `platform/host-app/pages/api/rpc/[fn].ts:56`
- `platform/host-app/pages/api/rpc/[fn].ts:62`
- `platform/host-app/pages/api/rpc/[fn].ts:102`
- `platform/host-app/pages/api/rpc/relay.ts:37`
- `platform/host-app/pages/api/rpc/relay.ts:56`

Admin console API routes also return `{ error: string }`:
- `platform/admin-console/src/app/api/analytics/route.ts:105`
- `platform/admin-console/src/app/api/services/health/route.ts:71`

Evidence (server response writers):
- `reports/miniapp_review/http_response_writes_ts.txt`
- `reports/miniapp_review/http_response_writes_nextresponse.txt`
- `reports/miniapp_review/http_response_writes_edge.txt`

### Success response envelopes are inconsistent
Example: host app proxy routes return upstream payload directly, but some endpoints wrap in `{ stats }` / `{ status: "ok" }`:
- `platform/host-app/pages/api/miniapp-stats.ts:24`
- `platform/host-app/pages/api/miniapp-stats.ts:30`
- `platform/host-app/pages/api/health.ts:15`

Evidence: `reports/miniapp_review/http_response_writes_ts.txt`

### Mixed logging approaches
At least three patterns exist:
- Host app: `logger.*` abstraction over `console.*` (`platform/host-app/lib/logger.ts:12`)
- Edge: direct `console.*` + a separate `tee` helper (`platform/edge/functions/_shared/tee.ts:10`)
- Go services: mixed patterns captured in `reports/miniapp_review/logging_usages.txt`

Evidence:
- `reports/miniapp_review/logging_usages.txt`
- `reports/miniapp_review/console_usage_prod.txt`

### Naming convention mix (camelCase vs snake_case)
Snake_case identifiers appear heavily across TS/JS code (some likely intentional for API/DB compatibility):
- Exhaustive scan: `reports/miniapp_review/snake_case_usages.txt`
- Top offenders (non-test TS/JS): `reports/miniapp_review/stats.md`

### Mixed async patterns
Most TS/JS uses `async/await`, but there is still `.then/.catch` chaining in UI code:
- `platform/host-app/pages/launch/[id].tsx:234`
- `platform/host-app/pages/launch/[id].tsx:235`
- `platform/host-app/pages/launch/[id].tsx:236`
- `platform/host-app/pages/launch/[id].tsx:240`

Evidence:
- `reports/miniapp_review/async_patterns.txt`
- `reports/miniapp_review/async_then_prod.txt`
- `reports/miniapp_review/async_catch_prod.txt`

