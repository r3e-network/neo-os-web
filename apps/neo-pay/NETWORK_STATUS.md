# NeoPay Network Status

Read-only verification date: **2026-07-11**

| Network | Canonical contract | Contract name | `totalStreams` | `isPaused` | Latest stream read |
| --- | --- | --- | ---: | --- | --- |
| Neo N3 Mainnet | `0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34` | `MiniAppNeoPay` | 12 | `false` | `getStreamDetails(12)` → `HALT` |
| Neo N3 Testnet | `0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e` | `MiniAppNeoPay` | 2126 | `false` | `getStreamDetails(2126)` → `HALT` |

The business ABI is aligned across both deployments and was read directly from
each deployed contract manifest:

- Reads: `isPaused/0`, `totalStreams/0`, `getStreamDetails/1`,
  `getUserStreams/3`, `getBeneficiaryStreams/3`
- Writes: `createStream/8`, `claimStream/2`, `cancelStream/2`
- Confirmation events: `StreamCreated/5`, `StreamClaimed/4`,
  `StreamCancelled/4`

Production confirmation rules:

1. Every read and write uses the canonical contract hash for the detected network.
2. GAS values are strict Fixed8 integers; NEO values are whole tokens.
3. A relayed transaction is stored as pending, not success.
4. Success requires the exact app event plus a matching authoritative stream readback.
5. Pending records are bound to transaction, wallet actor, network, contract, operation, and expected values.
6. An indexed `FAULT` clears the pending record without emitting success.
7. Transaction IDs must be exact Neo N3 32-byte hashes; shortened or malformed
   identifiers never enter recovery.
8. The local transaction journal must pass write, readback, delete, and delete
   readback checks before a wallet action can open.
9. Wallet, network, and contract are checked again after asynchronous preflight;
   a changed context cancels the prepared action.
10. Account-index reads use a wallet generation guard, so a late response from
    the previous wallet cannot replace the newly connected wallet's stream list.
11. A known launch network may keep read-only views available during transient
    detection failures, but no wallet write or recovery can proceed until the
    wallet network is positively detected.

No deployment, contract update, funded transaction, or account use was performed during this verification pass.

## 双网状态

核验日期：**2026-07-11**。主网和测试网的 `MiniAppNeoPay` 业务 ABI 一致，均处于未暂停状态；本次仅进行了只读 RPC 核验，没有部署合约、更新合约、提交带资金交易或使用测试账户。
