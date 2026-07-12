# NeoPay Stream Studio Network Status

Read-only verification date: **2026-07-12**

| Network | Canonical contract | Live contract | `totalStreams` | `isPaused` | Latest stream |
| --- | --- | --- | ---: | --- | --- |
| Neo N3 Mainnet | `0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34` | `MiniAppNeoPay` | 12 | `false` | `getStreamDetails(12)` → `HALT` / `Map` |
| Neo N3 Testnet | `0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e` | `MiniAppNeoPay` | 2126 | `false` | `getStreamDetails(2126)` → `HALT` / `Map` |

The production UI binds wallet actions to the exact hash for the launch network. An unknown network or mismatched contract keeps the primary wallet action disabled.

Expected live ABI:

- Reads: `totalStreams`, `getStreamDetails`, `getUserStreams`, `getBeneficiaryStreams`
- Writes: `createStream`, `claimStream`, `cancelStream`
- Events: `StreamCreated`, `StreamClaimed`, `StreamCancelled`

All seven required read/write methods were present in both live manifests. The two `totalStreams`, `isPaused`, and latest-detail invocations returned VM `HALT` during the read-only check.

The shared-runtime instance, recipe, module registry, and module binding metadata remains declared separately under `contract_composition`. The authoritative user-facing stream ledger and wallet actions use the canonical `MiniAppNeoPay` deployment for the selected network.

No deployment, funded transaction, wallet signing, or test account use was performed in this verification pass.

## 双网说明

工作台明确支持 Neo N3 主网和测试网，并将钱包操作绑定到当前网络对应的官方 `MiniAppNeoPay` 合约。未知网络或合约不匹配时，主要操作会保持锁定。本次仅执行只读 RPC 核验，没有部署、签名或资金交易。
