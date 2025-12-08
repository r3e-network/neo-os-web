# AccountPool Migration Notes

This repo now uses a shared `pool_accounts` table managed by the AccountPool service. Mixer no longer owns its own pool table.

## Fresh deployments
- Apply migrations in order. `003_service_persistence.sql` creates `pool_accounts` with lock columns and indexes.

## Upgrades from older deployments
- Apply `006_accountpool_schema.sql`. It:
  - Renames legacy `mixer_pool_accounts` to `pool_accounts` if present.
  - Adds missing `locked_by` and `locked_at` columns.
  - Ensures lock/retiring indexes exist.
- No data is dropped; rows are preserved.

## Verification checklist
- Table `pool_accounts` exists with columns: `id`, `address`, `balance`, `created_at`, `last_used_at`, `tx_count`, `is_retiring`, `locked_by`, `locked_at`.
- Indexes `pool_accounts_locked_by_idx` and `pool_accounts_is_retiring_idx` exist.
- Mixer is configured with `AccountPoolURL` and uses the AccountPool API for locking/releasing and balance updates.
