# Milestone Escrow production status

Status date: 2026-07-11

## Product surface

- The primary surface is now a milestone-funded workspace rather than a long setup form: project vault art, asset/beneficiary route, tranche timeline, creator/beneficiary ledgers, exact release progress, acceptance brief, refund review, and a conditional recovery pocket.
- NEO/GAS use the shared official token art. The 1440×810 escrow-stage image is a real app asset, separated from all text and controls so foreground contrast remains stable.
- Setup, preview, and signing-boundary views keep secondary detail out of the first task. Mobile collapses to one column, keeps the primary action at 48 px, and moves long milestone/recovery actions onto their own row.
- Motion is limited to status/progress feedback and honors `prefers-reduced-motion`.
- Static contrast checks for the main text/surface pairs range from 4.63:1 (muted field text) to 12.24:1 (primary text); evidence, recovery, warning, and error copy all exceed 6:1.

## Business behavior

- Beneficiary addresses must pass Neo N3 checksum validation before any wallet request.
- GAS is converted without floating point and supports up to 8 decimals; NEO remains whole-token only. Totals and all 1–12 tranche amounts are revalidated immediately before signing.
- Creation uses the token deposit followed by `createEscrow`; a deposit broadcast is never treated as a created escrow.
- Approve, claim, cancel, and recovery-capable paths re-read the exact escrow/milestone before invoking and verify the matching event values afterward.
- Pending broadcasts are kept on-device and remain visible until the ledger proves the state transition. A follow-up read outage does not rewrite a previously verified contract event as a failed transaction.
- Delivery evidence and disputes are explicitly off-chain because the deployed contract has no evidence store or arbiter. The UI displays the original acceptance brief but never presents off-chain files as verified.

## Current live boundary

Both current Neo N3 deployments use `0x442162de25008ac78d4cce62ed8d8a64401b7ece`, checksum `447355561`, and a 28-method ABI.

The live ABI does **not** contain:

- `directAssetCreditOf`
- `reclaimDirectAssetCredit`
- `reclaimApprovedMilestone`

Therefore the frontend treats the deployment as legacy:

- existing escrow approve / claim / cancel: enabled after exact live core checks;
- new escrow creation: fail-closed before any deposit signature;
- prepaid-credit and 30-day creator recovery buttons: not enabled or represented as live.

The local recovery-capable NEF checksum is `1925478399`. No contract deployment, update, transaction, or key use was performed in this pass.

## Release gate

Frontend production work is complete for the deployed business boundary. Reopening new escrow creation requires all of the following:

1. Deploy/update the recovery-capable contract.
2. Verify the deployed ABI and checksum independently on the selected network.
3. Run deposit → create, failed-create → reclaim credit, approve → claim, cancel, and 30-day recovery lifecycle tests.
4. Update this status file and the manifest deployment reason with the verified result.

## Verification evidence

- 146 scoped/shared/i18n/token-art/background tests passed across 9 files.
- The standalone contract-readiness suite passed 3/3; filtered contract tests passed 2/2.
- ESLint, app TypeScript, Vite production build, and scoped `git diff --check` passed.
- Local HTTP checks returned the expected MIME types for HTML, JSON, WebP, and JavaScript; the built manifest matches the source manifest byte-for-byte.
- The build retains the repository-wide Semi Sass deprecation notices and a 457.10 kB (137.92 kB gzip) app chunk warning. These are shared frontend-infrastructure follow-ups, not a failed app build.
- Current coded visual screenshot sign-off was not rerun because the required in-app browser surface was unavailable in this task. Static hierarchy, responsive, contrast, asset, and interaction checks passed, but they are not represented as a screenshot comparison.
