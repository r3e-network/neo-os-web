# Neo MiniApp Platform - Unified Monorepo Architecture

## Overview

This is a unified Turborepo monorepo supporting three platforms:
- **miniapps-uniapp**: MiniApps built with uni-app (Vue 3)
- **host-app**: Web platform built with Next.js 15
- **mobile-wallet**: Mobile wallet built with Expo/React Native

## Directory Structure

```
service_layer/
├── package.json              # Root package with Turborepo scripts
├── pnpm-workspace.yaml       # Unified workspace configuration
├── turbo.json                # Turborepo task configuration
├── packages/
│   └── @neo/
│       └── shared-core/      # Cross-platform shared utilities
├── miniapps-uniapp/
│   ├── apps/                 # Individual MiniApps
│   ├── packages/@neo/        # MiniApp-specific packages
│   │   ├── config/           # ESLint, Prettier, TypeScript configs
│   │   ├── types/            # Shared TypeScript types + Zod schemas
│   │   └── uniapp-sdk/       # UniApp SDK
│   └── shared/               # Shared UI components (@neo/ui)
├── platform/
│   ├── host-app/             # Next.js web platform (meshminiapp-host)
│   ├── mobile-wallet/        # Expo mobile wallet (neo-miniapp-wallet)
│   ├── admin-console/        # Admin console
│   ├── edge/                 # Supabase Edge Functions
│   └── sdk/                  # Platform SDK
└── scripts/
    └── fix-permissions.sh    # Fix node_modules permission issues
```

## Package Names

| Package | Name | Platform |
|---------|------|----------|
| Host App | `meshminiapp-host` | Web (Next.js) |
| Mobile Wallet | `neo-miniapp-wallet` | Mobile (Expo) |
| MiniApps | `miniapp-*` | uni-app |
| Shared Core | `@neo/shared-core` | Cross-platform |
| Config | `@neo/config` | All |
| Types | `@neo/types` | All |
| UI | `@neo/ui` | MiniApps |
| SDK | `@r3e/uniapp-sdk` | MiniApps |

## Turborepo Commands

### Development

```bash
# Start all development servers
pnpm dev

# Start specific platform
pnpm dev:host       # Host app (Next.js)
pnpm dev:mobile     # Mobile wallet (Expo)
pnpm dev:miniapps   # All MiniApps
```

### Building

```bash
# Build everything
pnpm build

# Build specific platform
pnpm build:host     # Host app
pnpm build:mobile   # Mobile wallet
pnpm build:miniapps # All MiniApps

# Build specific app
pnpm turbo build --filter=miniapp-lottery
pnpm turbo build --filter=meshminiapp-host
```

### Testing & Linting

```bash
pnpm test           # Run all tests
pnpm lint           # Lint all packages
pnpm typecheck      # Type check all packages
```

## Cross-Platform Shared Package (@neo/shared-core)

The `@neo/shared-core` package provides platform-specific implementations:

```typescript
// Automatically resolves to correct implementation
import { formatAddress, formatAmount } from '@neo/shared-core';
import { randomBytes, hash160 } from '@neo/shared-core/crypto';
```

### Platform Resolution

| Platform | Entry Point |
|----------|-------------|
| Web (Next.js, uni-app H5) | `src/index.web.ts` |
| React Native (Expo) | `src/index.native.ts` |

### Exports

| Path | Description |
|------|-------------|
| `@neo/shared-core` | Main entry (platform-specific) |
| `@neo/shared-core/utils` | Utility functions |
| `@neo/shared-core/types` | TypeScript types |
| `@neo/shared-core/crypto` | Crypto utilities (platform-specific) |

## Turborepo Caching

Tasks are cached by default. Second builds show `FULL TURBO`:

```
$ pnpm turbo build --filter=miniapp-lottery
  Tasks:    1 successful, 1 total
  Cached:   1 cached, 1 total
  Time:     178ms >>> FULL TURBO
```

## Troubleshooting

### Permission Denied in node_modules

If you see permission errors during `pnpm install`:

```bash
sudo ./scripts/fix-permissions.sh
pnpm install
```

### Type Conflicts

If you see React type conflicts (e.g., Lucide icons not working as JSX):

1. Delete `node_modules` and `pnpm-lock.yaml`
2. Run `pnpm install` fresh

### Package Not Found

Ensure the package name matches exactly:
- Use `meshminiapp-host` not `host-app`
- Use `neo-miniapp-wallet` not `mobile-wallet`

## Adding a New MiniApp

1. Create app in `miniapps-uniapp/apps/your-app/`
2. Add `package.json` with name `miniapp-your-app`
3. Run `pnpm install` to register workspace
4. Build with `pnpm turbo build --filter=miniapp-your-app`

## Using Shared Packages

```typescript
// Import from shared core
import { formatAddress, PLATFORM } from '@neo/shared-core';

// Import from types (with Zod validation)
import { WalletStateSchema, TransactionResultSchema } from '@neo/types';

// Import from UI (MiniApps only)
import { AppLayout } from '@neo/ui';
```
