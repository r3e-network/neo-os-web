# Local Development

This repo no longer boots the old in-repo Oracle / AA service layer as the
default local workflow.

Current local development means:

1. run the platform apps from this repo
2. point `.env` at external Morpheus / AA integrations
3. optionally run the external repos separately if you need isolated service runtimes

## Supported Local Modes

### Mode A: Platform-only against deployed external services

Use this for normal frontend / gateway / contract integration work.

Requirements:

- `.env` with reachable external service URLs
- Supabase project keys
- Neo N3 RPC URL

Commands:

```bash
cd /Users/jinghuiliao/git/neo-miniapps-platform
npm install
npm run validate:miniapp-env -- --stage=prod --json

cd platform/host-app
npm run dev

cd ../admin-console
npm run dev
```

### Mode B: Platform repo plus external Oracle / AA repos

Use this when you need to debug the extracted runtimes themselves.

Run:

- this repo for host/admin/edge/contracts
- `neo-morpheus-oracle` for Oracle / DataFeed / VRF / Compute / Paymaster
- `neo-abstract-account` for AA relay / verifier / UX work

Then point this repo's `.env` to those running services.

## Required Env Wiring

At minimum:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_EDGE_URL`
- `NEO_RPC_URL`
- `NEO_NETWORK_MAGIC`
- `NEOFEEDS_URL`
- `NEOORACLE_URL`
- `NEOVRF_URL`
- `NEOCOMPUTE_URL`
- `TXPROXY_URL`

Optional but recommended when AA integration is needed:

- `AA_RELAY_URL`
- `AA_PAYMASTER_ENDPOINT`

## Host / Edge Integration Notes

- shared frontend Oracle / AA config lives in `apps/shared/constants/rpc.ts`
- `useOracle()` defaults to `/api/rpc` when no explicit edge base URL is given
- `useAbstractAccount()` defaults to `/api/aa/relay` for AA relay submission
- `/api/aa/relay` is only active when `AA_RELAY_URL` is configured

## Testnet Workflow Validation

To validate the platform against current testnet contracts:

```bash
cd /Users/jinghuiliao/git/neo-miniapps-platform
AA_TEST_WIF=<funded-aa-testnet-wif> \
bash deploy/scripts/verify_cross_repo_testnet.sh

# legacy compatibility-only submission checks
bash deploy/scripts/verify_testnet_workflows.sh --env-file .env --skip-stats-rollup-check
```

Use `verify_cross_repo_testnet.sh` as the default testnet validation command.
Only use `verify_testnet_workflows.sh` when you explicitly want to inspect the
legacy compatibility submission path.

## Legacy k3s / internal-service docs

Older docs and manifests in this repo may still reference a local
`service-layer` namespace or cluster-local DNS names. Treat those as legacy or
integration-lab artifacts unless they have been explicitly updated to the
current external-runtime boundary.
