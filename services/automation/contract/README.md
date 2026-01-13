# NeoFlow On‑Chain Contract

NeoFlow (`service_id`: `neoflow`) anchors automation task metadata and execution proofs on-chain using the **platform** `AutomationAnchor` contract.

## Canonical Source

- Contract implementation: `../../../contracts/AutomationAnchor/AutomationAnchor.cs`
- Platform contract overview: `../../../contracts/README.md`

## Purpose

`AutomationAnchor` provides:

- An **admin-controlled** task registry (`RegisterTask`).
- An **Updater-controlled** execution marker (`MarkExecuted`) with **nonce-based anti-replay**.

In production, the Updater should be the enclave-managed signer (GlobalSigner/TxProxy).

## Key Methods / Events

- `SetUpdater(updater)`: admin sets the Updater account.
- `RegisterTask(taskId, target, method, trigger, gasLimit, enabled)`: admin registers/updates a task definition.
- `MarkExecuted(taskId, nonce, txHash)`: Updater marks a task execution as completed (nonce must be unused).
- `IsNonceUsed(taskId, nonce)`: checks replay protection state.
- Events: `TaskRegistered`, `Executed`.

## Configuration

The service discovers the deployed contract via:

- `CONTRACT_AUTOMATION_ANCHOR_ADDRESS`: deployed contract address (see `../../../.env.example`).

On-chain writes are performed via `../../txproxy/README.md` (allowlisted sign+broadcast).
