# Neo Message Network Status

Read-only verification date: **2026-07-11**

| Layer | Network | Canonical endpoint / contract | Evidence |
| --- | --- | --- | --- |
| Message contract | Neo X mainnet (`0xba93`) | `0xd1906192c2308ae416aCDa96238cA846EBB83f15` | At `2026-07-11T16:47Z`, runtime bytecode was 4,303 bytes and zero-address inbox/outbox reads returned canonical empty ABI arrays. |
| Morpheus public runtime | Mainnet | `https://oracle.meshmini.app/mainnet` | At `2026-07-11T16:47Z`, `/v1/status` reported `operational` with healthy runtime; `/oracle/public-key` returned a 32-byte X25519 key. |
| Host frame bridge | Mainnet | `/api/morpheus/oracle/public-key` and `/api/morpheus/oracle/message-reveal` | CORS/preflight, input validation, upstream forwarding, timeout, and unavailable-service behavior are covered by host API tests. |
| Revealed-message read | Neo X mainnet | Message `#4` | Existing time-locked message remained publicly revealed with non-empty plaintext in the read-only live validator. |

Release boundaries:

- Neo X testnet is not advertised because this release has no verified testnet
  message-contract deployment.
- The message body is encrypted before the send transaction is requested.
- Writes are gated on the exact `neo-x-mainnet` network identifier; Neo X T4
  is not treated as a compatible deployment.
- Recipient reveal requires a fresh wallet-signed statement for the exact chain,
  contract, message ID, and issue time.
- No funded write, wallet signature, deployment, or external-state mutation was
  performed during this verification pass.
