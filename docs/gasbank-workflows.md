# Gas Bank Workflows

This document walks through the full ensure → deposit → withdraw lifecycle using both the HTTP API and `slctl`, including scheduling, multi-sig approvals, settlement attempts, and dead-letter operations.

## 1. Ensure an Account

```bash
slctl gasbank ensure --account <workspace-id> \
  --wallet 0xabc123... \
  --min-balance 5 \
  --daily-limit 10 \
  --required-approvals 2
```

HTTP:
```http
POST /accounts/{id}/gasbank
{
  "wallet_address": "0xabc123...",
  "min_balance": 5,
  "daily_limit": 10,
  "required_approvals": 2
}
```

## 2. Deposit Funds

```bash
slctl gasbank deposit --account <id> --gas-account <gid> \
  --amount 12.5 --tx-id 0x... --from 0x... --to 0x...
```

HTTP:
```http
POST /accounts/{id}/gasbank/deposit
{
  "gas_account_id": "<gid>",
  "amount": 12.5,
  "tx_id": "0x...",
  "from_address": "0x...",
  "to_address": "0x..."
}
```

## 3. Schedule a Withdrawal

```bash
slctl gasbank withdraw --account <id> --gas-account <gid> \
  --amount 4 --to 0xdead... --schedule-at 2024-07-01T12:00:00Z
```

HTTP:
```http
POST /accounts/{id}/gasbank/withdraw
{
  "gas_account_id": "<gid>",
  "amount": 4,
  "to_address": "0xdead...",
  "schedule_at": "2024-07-01T12:00:00Z"
}
```

Cron-style schedules are not yet supported; use `schedule_at` with an RFC3339 timestamp for deferred execution.

The settlement poller activates scheduled withdrawals when due. Inspect the queue:

```bash
slctl gasbank withdrawals list --account <id> --gas-account <gid> --status scheduled
```

## 4. Approvals & Attempts

List approvals:

```bash
slctl gasbank approvals list --account <id> --transaction <tx>
```

Approve:

```bash
slctl gasbank approvals submit --account <id> \
  --transaction <tx> --approver alice --approve --note "LGTM"
```

Check settlement attempts:

```bash
slctl gasbank withdrawals attempts --account <id> --transaction <tx>
```

HTTP:
```http
GET /accounts/{id}/gasbank/withdrawals/{tx}/attempts
```

## 5. Dead-letter & Retry

List dead letters:

```bash
slctl gasbank settlement deadletters list --account <id>
```

Retry a DLQ entry:

```bash
slctl gasbank settlement deadletters retry --account <id> --transaction <tx>
```

Delete/cancel:

```bash
slctl gasbank settlement deadletters delete --account <id> --transaction <tx>
```

HTTP equivalents:
```
GET    /accounts/{id}/gasbank/deadletters
POST   /accounts/{id}/gasbank/deadletters/{tx}/retry
DELETE /accounts/{id}/gasbank/deadletters/{tx}
```

## 6. Cancel a Withdrawal

```bash
slctl gasbank withdrawals cancel --account <id> --transaction <tx> --reason "manual rollback"
```

HTTP:
```http
PATCH /accounts/{id}/gasbank/withdrawals/{tx}
{
  "action": "cancel",
  "reason": "manual rollback"
}
```

## 7. Inspecting Transactions

```bash
slctl gasbank transactions --account <id> --gas-account <gid> \
  --type withdrawal --status pending --limit 20
```

HTTP:
```
GET /accounts/{id}/gasbank/transactions?gas_account_id=<gid>&type=withdrawal&status=pending&limit=20
```

Use `slctl gasbank summary` or the dashboard to monitor `TotalLocked`, pending counts, and alerts for low balances or DLQ entries.

--- 

For more details on API schemas and CLI flags, see `cmd/slctl/main.go` and `applications/httpapi/handler_gasbank.go`. Devpack usage examples live in `examples/functions/devpack/`. Metrics appear under `gasbank_*` in `/metrics`.

## Devpack Example

`examples/functions/devpack/js/gasbank_workflow.js` shows how to:

- ensure a gas account for `params.wallet`,
- capture the current balance via `Devpack.gasBank.balance`,
- enqueue a (scheduled) withdrawal, and
- list recent withdrawals with `Devpack.gasBank.listTransactions`.

Use the sample as a starting point for in-function treasury automation and adjust parameters (`amount`, `scheduleAt`, `destination`) per workspace policies.
