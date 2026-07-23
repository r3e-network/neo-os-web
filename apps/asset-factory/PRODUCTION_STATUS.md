# Asset Factory v1.2.0 production status

Status date: 2026-07-11

Asset Factory is production-ready as a **NEP-17 blueprint design, review, export, Owner-wallet signature capture, refresh-recovery, and read-only Factory-record inspection tool**. Contract deployment and token minting are intentionally unavailable.

## Product result

- The existing 1672×941 mint-studio artwork is the primary product surface, not a decorative banner behind a form.
- The live token hierarchy shows name/symbol, initial supply, decimals, mint policy, and current Owner before secondary operational detail.
- Owner, treasury, and the single TestNet target remain editable in a secondary issuer disclosure.
- Generic shell tabs, status tiles, sidebar, activity feed, and duplicate sign operation are removed; the app-owned studio owns the complete workflow.
- Each state has one dominant action: lock the deterministic blueprint, then capture the Owner-wallet signature. The unavailable deployment action is not rendered.
- The copied package includes `execution.available` and its blocked reason alongside the planned call metadata, so `deploymentCall` cannot be mistaken for a write capability.
- Package JSON, checklist, deployment registry, and diagnostic details stay in secondary disclosures.

## Capability boundary

| Capability | Status | Exact behavior |
| --- | --- | --- |
| Token design and validation | Ready | Covers NEP-17 name, symbol, supply, decimals, Owner, treasury, mintability, and TestNet. |
| Deterministic blueprint | Ready | Canonical package ID/digest and exact copyable JSON. |
| Refresh recovery | Ready | Rebuilds and compares the stored draft, package ID, digest, captured signature message, and signer. |
| Wallet signature | Captured, not independently verified | Connected wallet must match Owner; a wallet/plan change clears or discards the response. No transaction is sent. |
| Factory record read | Ready | Compares package, template, digest, and creator; RPC failure remains `unavailable`. |
| Non-empty recorded contract hash | Display only | Labeled as the Factory-recorded hash; this check does not inspect the token contract ABI or state. |
| Deployment price/fee | Unavailable | No executable call exists, so the app displays no invented estimate or price. |
| Factory write / token deployment / mint | Locked | No invocation permission, CTA, signing transaction, txid, event, or contract result is produced. |
| Pending / retry / readback | Not applicable | No write exists in this release, so there is no pending transaction or job. |

## Verified TestNet boundary

Configured Factory: `0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49`

Read-only verification found:

- `MiniAppFactory`, contract ID `7310`, update counter `0`;
- six registered templates and one deployment record;
- legacy `deployFromTemplate/4` is present;
- `deployArtifactFromTemplate/6` is absent;
- `getTemplate("tpl.nep17.asset.v1")` returned `HALT`, version `1.0.0`, `HasArtifact = false`;
- the existing record `dep-test-1780463223002` contains a twenty-zero-byte deployed hash.

The metadata-only legacy write can record a package with `UInt160.Zero`; it cannot create a creator-specific NEP-17 token. Full evidence is in [NETWORK_STATUS.md](./NETWORK_STATUS.md).

## Requirements before enabling deployment

1. Deploy and re-read a Factory ABI containing the reviewed `deployArtifactFromTemplate/6` implementation.
2. Register the exact generated `FactoryNep17Token` NEF and governed manifest under `tpl.nep17.asset.v1`.
3. Verify wallet network and connected Owner before invocation.
4. Persist a durable pending journal before submission, including network, wallet, Factory hash, operation, artifact digest, package ID, and real txid.
5. Retry readback by transaction/package identity; never resubmit blindly.
6. Require a real txid, `TokenDeployed` event, exact `getDeployment` readback, and non-zero deployed hash.
7. Read the deployed contract and verify its manifest, NEP-17 ABI, name, symbol, decimals, total supply, Owner, and treasury.
8. Prove restart/recovery and never convert rejection, timeout, RPC failure, or absent readback into a zero/empty success result.

Creator-unique NEF/manifest generation and the digest over NEF, manifest, and canonical init parameters are implemented and covered by local tests; they are not live deployment evidence.

## Verification completed

- One serial focused Vitest command: 6 files, 51 tests passed.
- Asset Factory TypeScript: passed.
- App and directly affected shared ESLint: passed with zero warnings.
- Production build: 1,884 modules transformed in 3.05 seconds.
- Dist size: 916 KB.
- App JS: 265.10 KB raw / 78.36 KB gzip.
- React vendor: 141.85 KB raw / 45.56 KB gzip.
- Platform SDK: 93.17 KB raw / 30.01 KB gzip.
- UI vendor: 33.76 KB raw / 11.85 KB gzip.
- CSS: 162.61 KB raw / 26.01 KB gzip.
- Primary studio WebP: 83,624 bytes.
- Non-browser HTTP smoke: HTML, manifest, studio WebP, logo WebP, and production JS all returned HTTP 200 with correct MIME types.
- Manifest smoke confirmed version `1.2.0`, transactions disabled, and only `wallet:sign-message` plus `read:blockchain` permissions.
- Scoped `git diff --check`: passed.
- Static contrast samples: 5.59:1–15.90:1.

No browser, Playwright, screenshot, deployment, wallet signing, funded transaction, secret, staging script, git add, or commit was used.
