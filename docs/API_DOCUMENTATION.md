# API Documentation (Current)

The **MiniApp Platform** exposes its public gateway via **Supabase Edge Functions**.
TEE services are internal (mesh/mTLS) and should be reached through Edge routing.

For the full intended API surface, see:

- `docs/service-api.md`
- `platform/edge/functions/README.md`

## Supabase Edge (Gateway)

Supabase deploys Edge functions under:

- `/functions/v1/<function-name>`

Key gateway endpoints in this repo:

- `wallet-nonce`, `wallet-bind` (bind Neo N3 address to Supabase user)
- `api-keys-*` (user API keys: create/list/revoke; raw key returned once)
- `pay-gas` (GAS `transfer` → PaymentHub; settlement **GAS only**)
- `vote-bneo` (Governance intent; governance **bNEO only**)
- `rng-request` (randomness via `neovrf`; optional RandomnessLog anchoring)
- `compute-execute`, `compute-jobs`, `compute-job` (host-gated `neocompute` script execution + job inspection)
- `automation-triggers`, `automation-trigger-*` (host-gated trigger management + audit via `neoflow`)
- `secrets-*` (user secrets management + per-service permissions)
- `gasbank-*` (delegated payments: balances, deposits, transactions)
- `datafeed-price` (read proxy for `neofeeds`)
- `oracle-query` (allowlisted HTTP fetch proxy for `neooracle`)
- `miniapp-stats` (public stats + manifest metadata)
- `miniapp-notifications` (public notification feed)
- `market-trending` (public trending list)
- `miniapp-usage` (authenticated per-user daily usage)

## TEE Services (Internal)

Stable service IDs (runtime) used throughout the repo:

- `neofeeds` (datafeed)
- `neooracle` (oracle fetch)
- `neocompute` (confidential compute)
- `neovrf` (verifiable randomness)
- `neoflow` (automation)
- `txproxy` (allowlisted tx signing/broadcast)

## Legacy

The previous "Gateway binary + legacy REST API" documentation has been moved to:

- `docs/legacy/API_DOCUMENTATION_LEGACY_GATEWAY.md`

## NeoFlow Automation API

The NeoFlow service provides automation capabilities through Supabase Edge Functions.
All endpoints require authentication and wallet binding.

### Authentication

All automation endpoints require:

- `Authorization: Bearer <supabase-jwt>` header
- Bound Neo N3 wallet (via `wallet-bind`)
- Host scope permission (for host-gated endpoints)

### Trigger Management Endpoints

#### GET /functions/v1/automation-triggers

List all triggers for the authenticated user.

**Request:**

```http
GET /functions/v1/automation-triggers
Authorization: Bearer <supabase-jwt>
```

**Response:**

```json
[
    {
        "id": "uuid",
        "name": "Daily Price Alert",
        "trigger_type": "cron",
        "schedule": "0 0 * * *",
        "condition": null,
        "action": {
            "type": "webhook",
            "url": "https://example.com/webhook",
            "method": "POST",
            "body": { "message": "Daily alert" }
        },
        "enabled": true,
        "last_execution": "2025-12-28T00:00:00Z",
        "next_execution": "2025-12-29T00:00:00Z",
        "created_at": "2025-12-01T00:00:00Z"
    }
]
```

#### POST /functions/v1/automation-triggers

Create a new automation trigger.

**Request:**

```http
POST /functions/v1/automation-triggers
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "name": "Daily Price Alert",
  "trigger_type": "cron",
  "schedule": "0 0 * * *",
  "action": {
    "type": "webhook",
    "url": "https://example.com/webhook",
    "method": "POST",
    "body": {"message": "Daily alert"}
  }
}
```

**Trigger Types:**

- `cron`: Time-based trigger with cron expression
    - Requires `schedule` field with cron expression
    - Example: `"0 0 * * *"` (daily at midnight)
    - Example: `"*/15 * * * *"` (every 15 minutes)

- `interval`: Fixed interval trigger
    - Requires `schedule` field with interval string
    - Supported: `"hourly"`, `"daily"`, `"weekly"`, `"monthly"`

- `price`: Price threshold trigger
    - Requires `condition` field with price condition
    - Example: `{"feed_id": "BTC/USD", "operator": ">", "threshold": 50000}`

- `threshold`: Balance threshold trigger
    - Requires `condition` field with threshold condition
    - Example: `{"address": "0x...", "asset": "GAS", "operator": "<", "threshold": 100}`

**Response:**

```json
{
  "id": "uuid",
  "name": "Daily Price Alert",
  "trigger_type": "cron",
  "schedule": "0 0 * * *",
  "action": {...},
  "enabled": true,
  "created_at": "2025-12-28T00:00:00Z"
}
```

#### GET /functions/v1/automation-trigger

Get a specific trigger by ID.

**Request:**

```http
GET /functions/v1/automation-trigger?id=uuid
Authorization: Bearer <supabase-jwt>
```

**Response:**

```json
{
    "id": "uuid",
    "name": "Daily Price Alert",
    "trigger_type": "cron",
    "schedule": "0 0 * * *",
    "enabled": true,
    "last_execution": "2025-12-28T00:00:00Z",
    "next_execution": "2025-12-29T00:00:00Z",
    "created_at": "2025-12-01T00:00:00Z"
}
```

#### PUT /functions/v1/automation-trigger-update

Update an existing trigger.

**Request:**

```http
PUT /functions/v1/automation-trigger-update
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "id": "uuid",
  "name": "Updated Name",
  "schedule": "0 12 * * *"
}
```

**Response:**

```json
{
    "id": "uuid",
    "name": "Updated Name",
    "trigger_type": "cron",
    "schedule": "0 12 * * *",
    "enabled": true,
    "created_at": "2025-12-01T00:00:00Z"
}
```

#### POST /functions/v1/automation-trigger-enable

Enable a disabled trigger.

**Request:**

```http
POST /functions/v1/automation-trigger-enable
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "id": "uuid"
}
```

**Response:**

```json
{
    "status": "enabled"
}
```

#### POST /functions/v1/automation-trigger-disable

Disable an active trigger.

**Request:**

```http
POST /functions/v1/automation-trigger-disable
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "id": "uuid"
}
```

**Response:**

```json
{
    "status": "disabled"
}
```

#### POST /functions/v1/automation-trigger-resume

Resume a paused trigger (recalculates next execution).

**Request:**

```http
POST /functions/v1/automation-trigger-resume
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "id": "uuid"
}
```

**Response:**

```json
{
    "status": "resumed",
    "next_execution": "2025-12-29T00:00:00Z"
}
```

#### DELETE /functions/v1/automation-trigger-delete

Delete a trigger permanently.

**Request:**

```http
DELETE /functions/v1/automation-trigger-delete
Authorization: Bearer <supabase-jwt>
Content-Type: application/json

{
  "id": "uuid"
}
```

**Response:**

```json
{
    "status": "deleted"
}
```

#### GET /functions/v1/automation-trigger-executions

Get execution history for a trigger.

**Request:**

```http
GET /functions/v1/automation-trigger-executions?trigger_id=uuid&limit=50&offset=0
Authorization: Bearer <supabase-jwt>
```

**Query Parameters:**

- `trigger_id` (required): Trigger UUID
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**

```json
[
    {
        "id": "uuid",
        "trigger_id": "uuid",
        "executed_at": "2025-12-28T00:00:00Z",
        "success": true,
        "error": null,
        "action_type": "webhook",
        "action_payload": {
            "url": "https://example.com/webhook",
            "method": "POST",
            "status_code": 200
        }
    },
    {
        "id": "uuid",
        "trigger_id": "uuid",
        "executed_at": "2025-12-27T00:00:00Z",
        "success": false,
        "error": "Connection timeout",
        "action_type": "webhook",
        "action_payload": {
            "url": "https://example.com/webhook",
            "method": "POST"
        }
    }
]
```

### Action Types

Triggers can execute different types of actions:

#### Webhook Action

Execute an HTTP request to a specified URL.

```json
{
    "type": "webhook",
    "url": "https://example.com/webhook",
    "method": "POST",
    "body": {
        "message": "Trigger executed",
        "timestamp": "{{timestamp}}"
    }
}
```

**Supported Methods:** `GET`, `POST`, `PUT`, `DELETE`

**Template Variables:**

- `{{timestamp}}`: Current Unix timestamp
- `{{trigger_id}}`: Trigger UUID
- `{{trigger_name}}`: Trigger name

#### Contract Invocation Action

Invoke a Neo N3 smart contract method (requires on-chain anchoring).

```json
{
    "type": "contract",
    "contract_hash": "0x...",
    "method": "methodName",
    "params": [
        { "type": "String", "value": "param1" },
        { "type": "Integer", "value": 123 }
    ]
}
```

### Error Codes

- `400 BAD_INPUT`: Missing or invalid request parameters
- `400 BAD_JSON`: Invalid JSON body
- `401 UNAUTHORIZED`: Missing or invalid authentication token
- `403 FORBIDDEN`: Insufficient permissions or wallet not bound
- `404 NOT_FOUND`: Trigger not found or not owned by user
- `405 METHOD_NOT_ALLOWED`: Invalid HTTP method
- `429 RATE_LIMIT_EXCEEDED`: Too many requests
- `500 INTERNAL_ERROR`: Server error

### Rate Limits

- Trigger creation: 10 per minute per user
- Trigger updates: 20 per minute per user
- Trigger listing: 30 per minute per user
- Execution history: 30 per minute per user

### Best Practices

1. **Use Descriptive Names**: Name triggers clearly to identify their purpose
2. **Test Actions First**: Verify webhook URLs and contract methods before creating triggers
3. **Monitor Execution History**: Check execution logs regularly for failures
4. **Set Appropriate Schedules**: Avoid overly frequent executions (respect rate limits)
5. **Handle Failures Gracefully**: Webhook endpoints should return 2xx status codes on success
6. **Disable Unused Triggers**: Disable or delete triggers that are no longer needed
