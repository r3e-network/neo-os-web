# Unbreakable Vault

A resource-led DeFi bounty vault. Creators escrow GAS behind a SHA-256 digest;
challengers inspect the exact asset, fee, expiry, and status before paying the
contract-defined attempt fee to try a secret.

## Product flow

1. Choose a bounty, difficulty, title, public hint, and matching secret.
2. The browser hashes the creation secret locally. Only the 32-byte digest is
   passed to `createVault`; plaintext is neither persisted nor placed in the
   recovery record.
3. Share the verified vault ID. Challengers load the authoritative vault state
   before entering a secret.
4. A failed attempt grows the bounty. A correct attempt atomically pays 98% of
   escrow to the winner after the 2% protocol fee. The creator can reclaim 98%
   of an unbroken expired vault.
5. Anyone can increase an active bounty from the secondary vault panel.

## Transaction correctness and recovery

Every write requires an explicitly detected wallet network and is bound to the
canonical contract, connected wallet, vault ID, exact fixed8 string amount,
contract pause/payment configuration, exact event slots, and an authoritative
`getVaultDetails` readback. Large asset amounts are never coerced through a
JavaScript floating-point number.

Testnet funding is a two-transaction flow: a GAS transfer, then the business
call. The app persists the transfer/action txids and blocks new writes until the
previous operation is resolved. If only the payment was broadcast, recovery
invokes the business method directly and never sends the payment again. An
attempt secret is deliberately not stored, so the user must re-enter it when
resuming a paid attempt.

The persisted recovery binding is a deterministic corruption/schema checksum,
not a signature. Product confirmation comes from the canonical network and
contract, exact HALT GAS transfer, wallet-selected signer, the contract's
memo-specific prepaid-credit bucket, and exact event plus authoritative
readback verification.

All write actions share one operation lock and freeze the reviewed wallet,
network, vault, amount, and secret input before broadcast. A changed target or
wallet aborts before a new transaction is requested. If storage fails after a
broadcast, the exact in-memory journal must be restored durably before recovery
or another payment can continue.

The mainnet ABI has a trailing PaymentHub receipt ID for create, attempt, and
increase operations. The deployed mainnet contract currently reports no
PaymentHub, so mainnet remains honestly read-only. Once configured, funded
writes require a positive settled receipt ID; the app never uses the
incompatible testnet call shape.

## Canonical deployments

| Network | Contract | Funded write lane |
|---|---|---|
| Neo N3 testnet | `0x78fbd57ccfae14fff4b043a82eb491de542d8eb0` | Direct GAS prepay, then contract action |
| Neo N3 mainnet | `0x198bfcccabb9b73181f23b5af22fe73afdc6c3aa` | Settled PaymentHub receipt ID |

Network evidence, honest product boundaries, and remaining funded checks are
recorded in [`NETWORK_STATUS.md`](./NETWORK_STATUS.md). Artwork custody and
derivative details are recorded in
[`ASSET_PROVENANCE.md`](./ASSET_PROVENANCE.md).

## Local development

```bash
npm run dev -- --port 5361
npm run build
```

Open `http://127.0.0.1:5361/?network=testnet&lang=en`.
