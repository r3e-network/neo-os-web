# AccountPool Supabase Repository

Persistence layer for `infrastructure/accountpool`.

This package owns all Supabase/PostgREST reads/writes for pool accounts and
their per-token balances.

## Tables

- `pool_accounts`: account metadata (address, lock state, rotation flags)
- `pool_account_balances`: per-token balances for each account

## Repository Interface

See `repository.go` for the authoritative interface. Key categories:

- Account CRUD: `Create`, `Update`, `GetByID`, `List`, `ListAvailable`, `ListByLocker`, `Delete`
- Balance-aware reads: `GetWithBalances`, `ListWithBalances`, `ListAvailableWithBalances`, `ListByLockerWithBalances`
- Balance ops: `UpsertBalance`, `GetBalance`, `GetBalances`, `DeleteBalances`
- Stats: `AggregateTokenStats`

## Usage

```go
import accountpoolsupabase "github.com/R3E-Network/service_layer/infrastructure/accountpool/supabase"

repo := accountpoolsupabase.NewRepository(baseRepo)

accounts, err := repo.ListAvailableWithBalances(ctx, "GAS", nil, 10)
_ = accounts
_ = err
```

