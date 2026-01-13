# Getting Started

This guide helps you get started with the Neo MiniApp Platform.

## Prerequisites

- Node.js 18+ and npm/pnpm
- Neo wallet (NeoLine, O3, or OneGate)
- Basic knowledge of React/Next.js

## Installation

```bash
# Clone the repository
git clone https://github.com/user/service_layer.git
cd service_layer/platform/host-app

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development server (auto-copies miniapps + registry)
pnpm dev
```

## Environment Setup

Edit `.env.local` with your configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Connect Your Wallet

1. Install a Neo wallet browser extension
2. Click "Connect Wallet" in the navigation
3. Approve the connection request
4. Your address will appear in the header

## Explore MiniApps

1. Browse the homepage for featured apps
2. Use categories to filter by type
3. Click any app to launch it
4. Interact using your connected wallet

## Build or Add a MiniApp (Auto-Registration)

1. Create a new app folder in `miniapps-uniapp/apps/<your-app>`.
2. Add a `neo-manifest.json` (source of truth for permissions + metadata).
3. Run auto-discovery (or let host `predev` handle it):

```bash
node miniapps-uniapp/scripts/auto-discover-miniapps.js
```

The host app also runs `scripts/export_host_miniapps.sh` on `predev`/`prebuild`,
which copies built MiniApps and refreshes the registry automatically.
Keep `app_id` aligned with your MiniApp `APP_ID` constant so SDK calls are
scoped correctly.
If a MiniApp has no `dist/build/h5` output yet, the export script will build it
on-demand so newly added apps work without extra manual steps.

## UniversalMiniApp Contract

All MiniApps can use the shared UniversalMiniApp contract. If you need on-chain
events or storage, set `contracts.<chain>.address` in `neo-manifest.json` to the UniversalMiniApp
hash for your network. Otherwise you can omit it and keep the MiniApp frontend-only.

## Next Steps

- [API Reference](./API.md) - Learn the REST API
- [SDK Guide](./SDK.md) - Build your own MiniApp
- [Architecture](./ARCHITECTURE.md) - Understand the system
