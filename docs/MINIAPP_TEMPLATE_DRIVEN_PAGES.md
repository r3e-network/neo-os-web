# Template-Driven MiniApp Detail Pages

This project now supports a Polymarket-style pattern for MiniApp detail pages:

- Left panel: information, rules, comments/reviews/news (tabbed)
- Right panel: operation box for configuring and submitting transactions
- No per-miniapp page implementation in frontend code

## How It Works

1. Admin publishes MiniApp metadata to `miniapps` (`manifest` JSON, plus standard fields).
2. Host app reads `/api/miniapps/catalog?app_id=...`.
3. `coerceMiniAppInfo(...)` parses template and operation schema from manifest/top-level fields.
4. `pages/miniapps/[id].tsx` renders a shared layout using the parsed schema.

## Standardized Admin Flow (Polymarket-Style)

MiniApps can now be created/managed as backend configs with no per-page frontend coding:

1. Create/update config with `POST /api/miniapps/admin/upsert`.
2. Set lifecycle via action:
   - `save_draft` -> `pending`
   - `publish` -> `active`
   - `disable` -> `disabled`
3. Host detail page is auto-rendered from manifest template and operations.

Admin-only endpoints:

- `GET /api/miniapps/admin/blueprints` -> built-in blueprint catalog (`default`, `prediction`)
  returns `starter` payload blocks that admin can copy/fill directly
- `POST /api/miniapps/admin/upsert` -> validates + normalizes config + upserts DB row/manifest
- `POST /api/miniapps/admin/status` -> lifecycle status transition

Example upsert payload:

```json
{
  "app_id": "miniapp-election-2028",
  "name": "Election 2028 Market",
  "entry_url": "https://apps.example.com/election-2028",
  "developer_user_id": "123e4567-e89b-12d3-a456-426614174000",
  "blueprint": "prediction",
  "action": "publish",
  "permissions": { "payments": true, "datafeed": true },
  "limits": { "max_gas_per_tx": "10", "daily_gas_cap_per_user": "100" },
  "operations": [
    {
      "name": "Buy YES",
      "method": "buyYes",
      "button_style": "primary",
      "params": [{ "name": "amount", "type": "amount", "required": true }]
    }
  ],
  "manifest": {
    "page_template": {
      "tabs": [
        { "id": "market-info", "label": "Market Info", "type": "content" },
        { "id": "reviews", "label": "Reviews", "type": "reviews" },
        { "id": "forum", "label": "Comments", "type": "forum" }
      ]
    }
  }
}
```

Auth (at least one required):

- `MINIAPP_ADMIN_API_KEY` (header `x-admin-key`)
- `MINIAPP_ADMIN_WALLETS` (comma-separated wallet allowlist, via bearer wallet auth)

Writes require:

- `SUPABASE_SERVICE_ROLE_KEY`
- Optional `MINIAPP_ADMIN_DEFAULT_DEVELOPER_USER_ID` for backend-managed records

## Supported Config Fields

The parser checks these fields in order:

- `detail_template`
- `page_template`
- `page_config`
- `manifest.detail_template`
- `manifest.page_template`
- `manifest.page_config`
- `manifest.ui`
- `manifest.page`

Operation schema is resolved from:

- `operations`
- `operation_schema`
- `manifest.operations`
- `operation_panel.operations`

## Template Shape

```json
{
  "manifest": {
    "page_template": {
      "layout": "prediction",
      "hero": {
        "eyebrow": "Prediction Market",
        "disclaimer": "Prices imply probabilities, not guarantees."
      },
      "tabs": [
        {
          "id": "market-info",
          "label": "Market Info",
          "type": "content",
          "blocks": [
            {
              "type": "notice",
              "tone": "info",
              "content": "Settlement is controlled by market oracle rules."
            },
            {
              "type": "key_value",
              "title": "Facts",
              "items": [
                { "key": "Market Type", "value": "Binary" },
                { "key": "Asset", "value": "GAS" }
              ]
            }
          ]
        },
        { "id": "reviews", "label": "Reviews", "type": "reviews" },
        { "id": "forum", "label": "Comments", "type": "forum" },
        { "id": "news", "label": "Activity", "type": "news" }
      ],
      "operation_panel": {
        "title": "Trade Position",
        "subtitle": "Configure side and stake, then submit on-chain.",
        "cta_label": "Open Full Experience",
        "operations": [
          {
            "name": "Buy Position",
            "method": "buyPosition",
            "button_style": "primary",
            "params": [
              {
                "name": "side",
                "type": "select",
                "required": true,
                "options": [
                  { "label": "YES", "value": "yes" },
                  { "label": "NO", "value": "no" }
                ]
              },
              {
                "name": "stake",
                "type": "amount",
                "required": true,
                "placeholder": "10"
              }
            ]
          }
        ]
      }
    }
  }
}
```

## Transaction Execution

- Right panel operations use wallet adapters (`NeoLine`, `O3`, `OneGate`) via `invoke(...)`.
- `operation.params` are transformed into NeoVM invoke args.
- Required fields are validated before submit.

## Result

To add a new predict-style MiniApp, admin only updates backend catalog/manifest content.
Frontend uses existing components and shared page renderer automatically.

## Repeatable Hardening Loop

Run the full production-readiness loop repeatedly (including `100` iterations) with:

```bash
npm --prefix platform/host-app run quality:loop -- 100
```
