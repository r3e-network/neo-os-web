# Recovery Guardian

Recovery Guardian is the user-facing social-recovery app for Neo Abstract Accounts. It is built around one state-driven journey instead of a contract parameter console:

1. Load the 20-byte AA account ID.
2. See the canonical `SocialRecoveryVerifier` policy and active recovery state.
3. Continue private NeoDID guardian approvals in the AA identity workspace.
4. Wait through the owner review window, then finalize here with the approved new-owner wallet.

The current owner can cancel any active recovery round. First-time guardian activation is intentionally paused in this build until the deployed verifier binds setup to the canonical AA account owner. Configured profiles remain fully usable for approvals, cancellation, finalization, and exact transaction recovery.

The primary screen stays focused on the current recovery state, guardian quorum, review-window countdown, and one next action. An unconfigured account gets an honest read-only state and refresh action rather than a transaction form that the deployed contract cannot safely authorize. Ticket expiry, contract routing, full hashes, and owner cancellation context stay in the details drawer.

## What is read

The app strictly reads the complete recovery profile from the deployed Social Recovery Verifier and the AA account binding from AA Core:

- owner, AA Core, account address, Morpheus Oracle, network, and account label
- AA-bound verifier and canonical AA backup owner
- guardian commitments, threshold, owner review delay, and recovery nonce
- active recovery target, approvals, initiation time, and executable time

A failed getter fails the complete snapshot. It is never converted to an empty, zero, or successful state. Configured profiles are considered canonically bound only when the AA verifier matches and the recovery verifier's stored owner still equals AA Core's backup owner.

Every loaded profile records the network it came from. After wallet connection, a write or identity handoff must resolve to that same network; a wallet network change invalidates the action instead of reusing a snapshot from another chain. Setup, cancellation, and finalization then reread the authoritative profile before signing, so a changed AA owner, recovery target, quorum, or review window cannot reuse a stale screen. Slower previous reads are ignored when the profile ID changes.

Configured legacy profiles with no owner review delay remain readable, but the UI labels them as requiring policy review rather than claiming normal protection.

## What is written now

- `cancelRecovery` — current-owner cancellation and nonce invalidation
- `finalizeRecovery` — completion with the approved new-owner wallet after threshold and delay

The public-package `setupRecovery` implementation remains prepared behind `FIRST_TIME_RECOVERY_SETUP_AVAILABLE = false`, but the production UI does not expose it and the hook rejects it before wallet connection or invocation. It may be enabled only after the external verifier is upgraded, tested, deployed, and the integration registry is updated.

Broadcast is not success. Before any wallet prompt, the app proves that its recovery journal can write, read back, and remove a unique marker. After broadcast it persists the exact transaction context and rereads the same record byte-for-byte before confirmation begins. It then requires a HALT application log, matches the exact recovery event, and rereads the profile before showing success.

While an exact transaction is pending, profile and ticket-expiry fields are locked. A restart restores the pending profile and network, and the user can retry confirmation without rebroadcasting the write. If storage becomes unavailable, cancellation and finalization signatures are paused and a clear retry-storage action replaces the blocked signature. For an already-broadcast transaction, that action writes and rereads the exact in-memory receipt before confirmation can resume, preventing a reload from losing the lock. A confirmed or faulted journal is removed only after deletion is also proven by readback.

## First-time activation boundary

The deployed `SocialRecoveryVerifier.SetupRecovery` accepts `owner` and `aaContract` as caller-supplied values and checks the witness of that supplied owner, but it does not prove that the owner is AA Core's backup owner for the account ID. Because the verifier later trusts the stored recovery owner, client-side checks alone are not an authoritative activation rule.

The external contract must bind setup to a trusted AA Core and its account configuration. A minimal robust path is to validate the AA Core verifier-config context for the same account ID, derive or assert the owner from that core's `getBackupOwner(accountId)`, and reject a caller-supplied alternate core. If setup is routed through AA Core `CallVerifier`, `setupRecovery` must also be added to its current verifier-method allowlist and the frontend invocation updated. That external contract build, test, deployment, and registry update are outside this app-only lane.

## Identity handoff

Recovery ticket requests use the live AA identity workspace with its actual query contract:

- `accountId`
- `account`
- `recoveryVerifier`
- `recoveryNewOwner`
- `recoveryExpiryMinutes`
- `autoPreviewRecovery=1`

The identity workspace encrypts the identity subject parameters before it invokes `requestRecoveryTicket`; this app never substitutes an empty or plaintext payload.

## Canonical surfaces

- AA identity workspace: `https://neo-abstract-account.vercel.app/identity`
- integration registry: `apps/shared/constants/rpc.ts`
- contract source: `neo-abstract-account/contracts/recovery/MorpheusSocialRecoveryVerifier.*.cs`
- deployed contract manifest: `apps/recovery-guardian/neo-manifest.json`
- current network evidence: `apps/recovery-guardian/NETWORK_STATUS.md`
- production verification: `apps/recovery-guardian/PRODUCTION_STATUS.md`
- artwork record: `apps/recovery-guardian/ASSET_PROVENANCE.md`
