# Universal MiniApp Configuration Guide

> **OS v2 Note (2026-03-30):** With MiniApp-OS v2, most MiniApps no longer
> need custom contracts. They can declare OS service permissions in their
> manifest (`storage`, `payment`, `game`, `badge`, `checkin`, `leaderboard`,
> `escrow`, `nft`, `vesting`, `script`) and call `ctx.os.*` proxies at
> runtime. The template-driven configuration system described below works
> alongside OS services -- the `permissions` section now accepts OS service
> names in addition to the original capability flags.

This guide explains how to create, configure, and manage MiniApps using the template-driven configuration system.

## Overview

The Universal MiniApp Platform allows you to create new MiniApps through configuration files rather than writing new code. Each MiniApp is defined by a JSON configuration file that specifies:

- Metadata (name, description, category)
- Contract configuration (template ID, init params)
- Frontend specification (layout, tabs, operations)
- Permissions and limits

## Quick Start

### 1. Create a New MiniApp Configuration

Use the generator script to create a new configuration:

```bash
# Create a prediction market
node scripts/generate-miniapp-config.ts --type prediction --id my-election-market --name "Election 2028"

# Create a lottery
node scripts/generate-miniapp-config.ts --type lottery --id weekly-lottery --name "Weekly GAS Lottery"

# Create a voting app
node scripts/generate-miniapp-config.ts --type voting --id community-vote --name "Community DAO Vote"

# List available template types
node scripts/generate-miniapp-config.ts --list
```

### 2. Customize the Configuration

Edit the generated JSON file in `platform/host-app/public/miniapp-definitions/`:

```json
{
  "app_id": "my-election-market",
  "name": "Election 2028",
  "description": "Predict the outcome of the 2028 presidential election",
  "template_type": "prediction",
  "frontend_spec": {
    "layout": "prediction",
    "tabs": [...],
    "operation_panel": {...}
  }
}
```

### 3. Import the Configuration

Import the configuration via the Admin API:

```bash
# Validate first (dry run)
curl -X POST "http://localhost:3000/api/miniapps/admin/import-definitions?dry_run=true" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $MINIAPP_ADMIN_API_KEY"

# Import for real
curl -X POST "http://localhost:3000/api/miniapps/admin/import-definitions" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $MINIAPP_ADMIN_API_KEY"
```

Or use the Admin Console at `/admin/miniapps`.

## Configuration Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `app_id` | string | Unique identifier (lowercase, hyphens only) |
| `name` | string | Display name |
| `template_type` | string | Template family (prediction, voting, lottery, etc.) |

### Template Types

| Type | Description | Use Case |
|------|-------------|----------|
| `prediction` | Binary/multi-outcome prediction markets | Elections, sports, events |
| `voting` | On-chain voting with privacy options | DAOs, governance |
| `lottery` | Chance-based games with draws | Weekly lotteries, instant wins |
| `auction` | Competitive bidding | NFT auctions, dutch auctions |
| `defi` | Financial primitives | Lending, swaps, yield |
| `nft` | NFT operations | Minting, collections |
| `tipping` | Payment and rewards | Creator support |
| `governance` | DAO tools | Delegation, proposals |
| `default` | Generic template | Custom apps |

### Frontend Specification

The `frontend_spec` object defines the page layout:

```json
{
  "frontend_spec": {
    "layout": "prediction",
    "hero": {
      "eyebrow": "Prediction Market",
      "disclaimer": "Trade responsibly."
    },
    "tabs": [
      {
        "id": "market-info",
        "label": "Market Info",
        "type": "content",
        "blocks": [...]
      },
      {
        "id": "reviews",
        "label": "Reviews",
        "type": "reviews"
      }
    ],
    "operation_panel": {
      "title": "Trade",
      "operations": [...]
    }
  }
}
```

### Tab Types

| Type | Description |
|------|-------------|
| `content` | Custom content with blocks |
| `reviews` | User reviews |
| `forum` | Discussion forum |
| `news` | Activity feed |
| `secrets` | Confidential data |

### Content Blocks

Each tab can contain multiple content blocks:

```json
{
  "blocks": [
    {
      "type": "markdown",
      "content": "## Market Rules\n\nSettlement rules..."
    },
    {
      "type": "key_value",
      "title": "Facts",
      "items": [
        { "key": "Market Type", "value": "Binary" },
        { "key": "Asset", "value": "GAS" }
      ]
    },
    {
      "type": "bullet_list",
      "title": "Rules",
      "items": ["Rule 1", "Rule 2", "Rule 3"]
    },
    {
      "type": "notice",
      "tone": "info",
      "content": "Important information"
    },
    {
      "type": "links",
      "title": "Resources",
      "items": [
        { "label": "Docs", "href": "https://...", "external": true }
      ]
    }
  ]
}
```

### Operation Panel

Define on-chain operations:

```json
{
  "operation_panel": {
    "title": "Trade Position",
    "subtitle": "Select your position and stake.",
    "cta_label": "Open Full Experience",
    "operations": [
      {
        "name": "Buy YES",
        "method": "buyYes",
        "button_style": "primary",
        "gas_cost": "~0.5 GAS",
        "params": [
          {
            "name": "amount",
            "type": "amount",
            "label": "Stake (GAS)",
            "required": true,
            "placeholder": "10.0"
          }
        ]
      }
    ]
  }
}
```

### Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text input | "My message" |
| `integer` | Whole number | 42 |
| `amount` | Numeric amount | "10.5" |
| `boolean` | True/false | true |
| `address` | Neo address | "N..." |
| `hash160` | Contract hash | "0x..." |
| `hash256` | Transaction hash | "0x..." |
| `select` | Dropdown selection | { options: [...] } |

## Contract Configuration

### Using Contract Templates

```json
{
  "contract": {
    "template_id": "prediction-binary",
    "init_params": {
      "oracle": "0x...",
      "settlement_timestamp": 1855622400,
      "fee_bps": 100
    }
  }
}
```

### Deployed Contracts

For existing contracts:

```json
{
  "contract": {
    "contract_hash": "0x1234567890abcdef1234567890abcdef12345678"
  }
}
```

## Permissions

Configure what capabilities the MiniApp has. Since OS v2, these include both
legacy capability flags and OS service permissions:

```json
{
  "permissions": {
    "payments": true,
    "datafeed": true,
    "confidential": false,
    "governance": false,
    "storage": true,
    "oracle": true,
    "randomness": true,
    "cross_chain": false,
    "game": true,
    "badge": true,
    "checkin": true,
    "leaderboard": true,
    "escrow": false,
    "nft": false,
    "vesting": false,
    "script": false
  }
}
```

## Limits

Set usage limits:

```json
{
  "limits": {
    "max_gas_per_tx": "10",
    "daily_gas_cap_per_user": "100",
    "governance_cap": "1000000",
    "max_users": 10000,
    "rate_limit": {
      "requests_per_minute": 60,
      "requests_per_hour": 1000
    }
  }
}
```

## Examples

See the example configurations:

- `prediction-market.example.json` - Full prediction market example
- `lottery.example.json` - Weekly lottery example
- `voting.example.json` - DAO voting example
- `tipping.example.json` - Developer tipping example

## Best Practices

1. **Start with a template**: Use the generator script to create a base configuration
2. **Validate before import**: Always use `dry_run=true` first
3. **Keep descriptions concise**: Clear, informative descriptions help users
4. **Use appropriate permissions**: Only request what you need
5. **Test thoroughly**: Verify all operations work correctly

## Troubleshooting

### Configuration not loading

- Check JSON syntax with a validator
- Ensure all required fields are present
- Verify the `$schema` reference is correct

### Operations not working

- Check contract method names match
- Verify parameter types are correct
- Ensure wallet is connected

### Template not rendering correctly

- Check tab types are valid
- Verify block types match content
- Ensure operation panel has valid operations
