# Admin Workflow Integration Design

**Date:** 2025-01-23
**Status:** Approved
**Author:** AI Design Partner

## Overview

This design documents the integration between the existing Admin Console UI and the newly deployed Edge Functions (`app-approve`, `app-status`) to create a complete admin approval workflow with on-chain updates.

**Problem:** The Admin Console currently calls Supabase REST API directly, bypassing the Edge Functions that handle on-chain AppRegistry updates, audit trails, and developer notifications.

**Solution:** Update Next.js API routes to proxy requests to Edge Functions, creating a unified approval workflow.

## Architecture

### Three-Tier Proxy Pattern

```
┌─────────────────────┐
│  Admin Console UI   │  (React hooks, unchanged)
│  /miniapps page     │
└──────────┬──────────┘
           │ HTTP POST
           ▼
┌─────────────────────┐
│  Next.js API Routes │  (Proxy layer, modified)
│  /api/miniapps/...  │
└──────────┬──────────┘
           │ Bearer token (service_role)
           ▼
┌─────────────────────┐
│  Edge Functions     │  (Business logic, deployed)
│  /functions/v1/...  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Database + Chain   │  (Atomic updates)
│  + TxProxy Service  │
└─────────────────────┘
```

### Key Benefits

- **Preserves existing UI** - No changes to React components or hooks
- **Centralizes business logic** - Edge Functions handle validation, on-chain updates, notifications
- **Maintains security** - Authentication passed through all layers
- **Enables audit trail** - All approvals logged in `miniapp_approvals`

## API Contract

### Request Transformation

**From Next.js (current):**

```json
{
    "appId": "com.example.app",
    "versionId": "uuid-123",
    "reviewNotes": "Optional notes"
}
```

**To Edge Function:**

```json
{
    "app_id": "com.example.app",
    "action": "approve", // or "reject" or "disable"
    "reason": "Required for reject only"
}
```

### Field Mapping

| Next.js Field | Edge Function Field | Notes                               |
| ------------- | ------------------- | ----------------------------------- |
| `appId`       | `app_id`            | Case transformation                 |
| `versionId`   | _(omitted)_         | Edge Function operates on app-level |
| `reviewNotes` | `reason`            | Only for reject action              |
| _(derived)_   | `action`            | From route: approve/reject/disable  |

### Response Transformation

**Edge Function returns:**

```json
{
    "request_id": "uuid",
    "app_id": "com.example.app",
    "action": "approve",
    "previous_status": "pending_review",
    "new_status": "approved",
    "reviewed_by": "user-id",
    "reviewed_at": "2025-01-23T13:00:00Z",
    "chain_tx_id": "0x..."
}
```

**Next.js returns to UI:**

```json
{
    "success": true
}
```

_(Backward compatible with existing UI)_

## Error Handling

### Error Categories

| Category       | HTTP Code | Example               | Action                   |
| -------------- | --------- | --------------------- | ------------------------ |
| Authentication | 401/403   | Invalid admin token   | Pass through to UI       |
| Validation     | 400       | Missing `app_id`      | Pass through `VAL_001`   |
| Transition     | 400       | Invalid status change | Pass through `VAL_007`   |
| Not Found      | 404       | App doesn't exist     | Pass through `NOT_FOUND` |
| On-chain       | 502/503   | TxProxy unavailable   | Logged, DB proceeds      |
| Database       | 500       | Update failed         | Pass through `DB_002`    |

### Retry Logic

- **Single retry** on network errors (`ECONNRESET`, `ETIMEDOUT`, `5xx`)
- **Idempotency** via `request_id` prevents duplicate transactions
- **No fallback** to direct DB access (prevents split-brain)

## Implementation

### Files to Modify

1. **`platform/admin-console/src/app/api/miniapps/registry/approve/route.ts`**
    - Proxy to `/functions/v1/app-approve`
    - Transform: `{appId}` → `{app_id, action: "approve"}`

2. **`platform/admin-console/src/app/api/miniapps/registry/reject/route.ts`**
    - Proxy to `/functions/v1/app-approve`
    - Transform: `{appId, reviewNotes}` → `{app_id, action: "reject", reason}`

3. **`platform/admin-console/src/app/api/miniapps/update-status/route.ts`**
    - Add "disable" action support
    - Proxy to `/functions/v1/app-approve`

### Environment Variables (Existing)

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role JWT for Edge Function auth

### Code Pattern

```typescript
const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/app-approve`;

// Retry wrapper
async function callWithRetry(url: string, body: unknown, retries = 1): Promise<Response> {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok && retries > 0 && isRetryable(response.status)) {
            return callWithRetry(url, body, retries - 1);
        }

        return response;
    } catch (error) {
        if (retries > 0 && isNetworkError(error)) {
            return callWithRetry(url, body, retries - 1);
        }
        throw error;
    }
}
```

## Testing

### Unit Tests (Vitest)

- Mock Edge Function responses
- Test request/response transformations
- Test error handling for each category
- Test retry logic

### Integration Tests

- Local Edge Functions via Deno
- Full flow: UI → Next.js → Edge Function → DB
- Verify on-chain transaction (mock TxProxy)
- Verify audit record in `miniapp_approvals`
- Verify developer notification

### Manual Testing Checklist

- [ ] Approve pending MiniApp → Status becomes `approved`
- [ ] Reject with reason → Status `suspended`, reason stored
- [ ] Disable approved app → Status becomes `suspended`
- [ ] Invalid transition → Returns `VAL_007`
- [ ] Non-existent app → Returns `404`
- [ ] Non-admin user → Returns `AUTH_004`
- [ ] On-chain AppRegistry → Status updated
- [ ] Developer notifications → Message received

## Rollout Plan

1. **Phase 1:** Implement Next.js API route changes
2. **Phase 2:** Deploy to staging, run integration tests
3. **Phase 3:** Deploy to production with monitoring
4. **Phase 4:** Monitor logs for errors, rollback if needed

## Success Criteria

- [x] Edge Functions deployed (`app-approve`, `app-status`) ✅
- [ ] Next.js API routes updated to proxy
- [ ] All manual tests passing
- [ ] Admin approval workflow end-to-end functional
- [ ] On-chain AppRegistry updates working
- [ ] Developer notifications sending correctly
- [ ] Audit trail in `miniapp_approvals` table

## Open Questions

None - design approved and ready for implementation.
