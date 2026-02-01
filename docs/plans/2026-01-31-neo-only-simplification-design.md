# Neo-Only Simplification Design

Date: 2026-01-31

## Goal

Simplify the miniapp platform to support **only Neo N3 mainnet and Neo N3 testnet**, removing all EVM support from code, configuration, and data. This is a forward-migration cleanup that preserves migration history but removes EVM tables/columns/seed data.

## Non-Goals

- No partial support or hidden toggles for EVM chains.
- No legacy dual-support mode.
- No preservation of EVM data in production.

## Recommended Approach

Option 1 (forward-migration cleanup):
- Add new migrations to drop EVM-specific tables/columns and delete EVM seed data.
- Remove all EVM code paths, types, adapters, and dependencies.
- Update all configuration, docs, fixtures, and tests to Neo-only expectations.

## Architecture Summary

- Chain family: **Neo N3 only**.
- Supported networks: **Neo N3 mainnet** and **Neo N3 testnet**.
- Chain registry and type unions collapse to those two networks.
- Wallet adapters and RPC/stats flows become Neo-only.
- Edge functions and admin console remove EVM branching entirely.

## Data Model and Migrations

- Add forward migrations to:
  - Drop EVM-specific tables and columns.
  - Remove EVM seed data from chain/network registries.
- Update seed scripts/fixtures to insert only Neo mainnet/testnet.
- Any foreign keys referencing chain IDs must align with the two Neo entries.

## Component Changes (High Level)

- `platform/host-app`
  - Remove EVM chain registry entries.
  - Remove MetaMask and EVM wallet adapters.
  - Collapse chain type checks to Neo-only.
- `platform/edge`
  - Remove shared EVM helpers.
  - Remove EVM logic from app update/manifest/build flows.
- Admin console
  - Restrict chain selection to Neo mainnet/testnet.
  - Remove EVM configuration and display logic.
- Shared services/SDKs
  - Remove EVM type unions, helpers, and dependencies.
- Docs/config/fixtures
  - Remove EVM references and lists.

## Error Handling

- Validation accepts only the two Neo network IDs.
- Any external input with other chain IDs yields a clear unsupported-chain error.
- No EVM fallback paths remain.

## Testing Strategy

- Update unit tests and fixtures to Neo-only chain IDs.
- Add/adjust tests to reject unsupported chain IDs.
- Run full test suite, including Deno edge tests, to ensure no EVM references remain.

## Rollout Notes

- This is destructive to EVM data; ensure backups and a maintenance window before applying migrations in production.
- After deploy, only Neo mainnet/testnet should appear in UI, APIs, and admin tools.

## Success Criteria

- No EVM references in code, config, or docs.
- Database contains only Neo mainnet/testnet chain data.
- Builds and tests pass with Neo-only expectations.
- Production behaves correctly without any EVM dependencies.
