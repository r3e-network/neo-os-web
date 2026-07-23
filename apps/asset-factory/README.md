# Asset Factory

Asset Factory is a warm, visual NEP-17 issuance studio. It turns a token design into a deterministic, reviewable blueprint and can ask the declared Owner wallet to sign that exact blueprint. It does not deploy or mint a token in this release.

## Primary flow

1. **Token object** — name and symbol update the mint-studio object immediately.
2. **Issuance economics** — initial supply, decimals, and fixed/mintable policy are visible in the primary stage hierarchy.
3. **Issuer** — Owner, treasury, and the single TestNet target live in the secondary issuer disclosure; the pipeline still identifies the current Owner.
4. **Review package** — lock the current design into a canonical blueprint with a deterministic package ID and digest.
5. **Issuer signature** — the connected wallet must match the declared Owner before the app asks it to sign. The wallet response is captured but not independently cryptographically verified by this app.
6. **Factory record check** — an optional read-only check compares package ID, template, digest, and creator. A non-empty hash is reported only as the hash recorded by the Factory; the token contract ABI and state are not inferred.

At each stage there is one dominant action: lock the blueprint, then sign it. The unavailable deployment action is not rendered.

## Deployment boundary

The configured TestNet Factory at `0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49` exposes the legacy `deployFromTemplate/4` ABI. Its `tpl.nep17.asset.v1` record is metadata-only (`HasArtifact = false`). That path can create a Factory registry record with a zero contract hash; it cannot create a user-specific NEP-17 contract.

The repository contains a newer `deployArtifactFromTemplate/6` implementation plus compiled, creator-specific `FactoryNep17Token` artifacts and exact digest/call generation. That ABI and governed artifact are not deployed at the configured hash. Asset Factory therefore:

- does not expose `invoke:primary`;
- sets `platform.transactions` to `false`;
- does not estimate or display a deployment price;
- overrides programmatic `executePlan` calls with a non-broadcasting status response;
- does not invent a transaction, pending state, contract hash, mint result, supply readback, or deployment success.

See [NETWORK_STATUS.md](./NETWORK_STATUS.md) for dated read-only evidence and [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md) for activation requirements.

## Refresh recovery

The local journal stores the normalized TestNet draft, locked digest/package ID, captured signature metadata, signing wallet, and timestamp. On reload it rebuilds the plan and restores only matching data. It is a blueprint journal, not a transaction journal.

There is no pending transaction or retry/readback state because this release performs no write. Before deployment can be enabled, a durable write journal must persist the exact request identity and real txid, then recover by readback rather than submitting again.

## Development

From `apps/asset-factory`:

```bash
npx tsc -p tsconfig.json --noEmit
npx eslint src
npm run build
```

Focused Factory tests run from `apps/shared` in one serial command:

```bash
npx vitest run --maxWorkers=1 factory-plans factory-chain factory-runtime factory-playarea asset-factory
```
