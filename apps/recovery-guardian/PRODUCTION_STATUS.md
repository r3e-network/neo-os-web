# Recovery Guardian production status

Version: `2.0.0`

Product direction:

- A warm guardian-vault scene and state-driven journey replace the generic recovery parameter console.
- The current profile, guardian quorum, recovery stage, countdown, and one next action hold the primary hierarchy.
- Unconfigured accounts show an honest read-only activation-pending state and one refresh action; no setup form or wallet prompt is exposed.
- Ticket expiry, full hashes, network routing, and owner-control context stay in the secondary drawer.
- A no-delay legacy policy is shown as requiring review instead of being presented as normal protection.
- Launcher banner and logo now use the same guardian-vault resource as the app rather than a generic `RG` letter mark.

Correctness and recovery behavior:

- Complete profile reads fail closed; a failed or malformed getter never becomes a zero/empty success snapshot. A configured profile is treated as AA-bound only when both the verifier address and the verifier's stored owner match AA Core's canonical verifier and backup owner.
- Each profile is bound to its source network. Wallet-driven actions re-resolve the network after connection and refuse cross-network reuse.
- First-time setup is disabled before wallet connection or invocation. The prepared future flow still rereads AA Core's verifier and backup owner, but client checks are not presented as an authoritative substitute for the missing contract invariant.
- Cancellation and finalization each refresh the authoritative profile after wallet/network resolution, so a changed owner, target, quorum, or review window is shown and rejected before signing.
- Read epochs prevent a slower previous account lookup from overwriting the latest profile.
- Cancellation and finalization use two-step confirmation.
- Every wallet write is blocked until recovery storage passes a real set/get/delete round trip.
- Broadcast context is persisted and read back exactly before confirmation, then restored with its exact profile and network after restart.
- Journal deletion is also verified. If persistence or deletion cannot be proven, the exact in-memory transaction remains locked and the primary action first restores that same journal durably; confirmation resumes only after exact write/readback succeeds, so a replacement signature cannot be sent or a reload lose the lock.
- Success requires a HALT application log, the exact expected contract event, and authoritative profile readback.
- FAULT, missing logs, event mismatch, and readback mismatch remain explicit failure or pending states.
- Pending writes lock profile and advanced fields so transaction recovery cannot drift to another account.

External contract-integration blocker:

- The deployed external `SocialRecoveryVerifier.SetupRecovery` checks `Runtime.CheckWitness(owner)` on a caller-supplied owner and accepts a caller-supplied AA contract; it does not bind either value to AA Core's canonical account state.
- `SocialRecoveryVerifier.VerifyExecution` subsequently trusts the stored recovery owner, so the activation invariant must be enforced on chain rather than only in this frontend.
- The minimum external correction is to bind setup to a trusted AA Core/configuration context for the same account ID, derive or assert the stored owner from `getBackupOwner(accountId)`, and reject an alternate caller-supplied core.
- If the owner-authorized `UnifiedSmartWallet.CallVerifier` route is used, its current `AllowedVerifierMethods` list must add `setupRecovery`; the current list does not contain it. The frontend must then invoke that corrected route.
- This requires external contract tests, artifact build, deployment/update, and integration-registry/manifest refresh. None of those cross-repository or deployment actions were performed in this scoped frontend lane.

Verification evidence (2026-07-12):

- Scoped production, chain logic, PlayArea and integration suites: `35/35` passed in one focused Vitest run from `apps/shared`, including strict VM decoding, full AA owner/verifier binding, the first-time activation gate before wallet/invoke, existing-profile pre-sign state rereads, stale-target rejection, storage preflight, post-broadcast journal loss, durable journal restoration, and no-replacement-signature cases.
- Recovery Guardian locale-parity target: `1` passed (`78` unrelated app cases skipped).
- TypeScript and ESLint passed for app source and directly related tests.
- The existing 2026-07-11 read-only network evidence in `NETWORK_STATUS.md` confirms `SocialRecoveryVerifier`, network-specific `UnifiedSmartWalletV3`, and network-specific `MorpheusOracle`; this scoped pass did not repeat live RPC probes.
- Production build: Vite `7.3.2`, `3573` modules transformed, completed in `6.36s`.
- Main app bundle: `224.46 kB` (`66.91 kB` gzip).
- App stylesheet: `102.80 kB` (`18.84 kB` gzip); shared UI vendor CSS/JS remain separately cached.
- HTTP smoke: all `17/17` emitted files returned `200`, including entry HTML, every JS/CSS chunk, manifest, guardian scene, banner, and logo.
- Source and emitted manifest SHA-256: `52ac367983d5271af30671d4ec4d6b59c56e5e274fab758f8f4c3e3ea4c357af`.
- Source and emitted guardian scene, banner, and logo were byte-identical; dimensions remained 1672×941, 1440×640, and 512×512 respectively.
- Host copy was intentionally not performed in this scoped app task. The integration owner must copy and byte-compare this new dist before release.
- Catalog metadata remains 77 entries, 77 unique IDs, exactly one `recovery-guardian` entry at version `2.0.0`; the global dApp support verifier passed `77/77`.
- Git index remained empty. No browser automation, screenshot capture, wallet signature, transaction, contract deployment, or Git staging/commit was performed.

The HTTP check is an artifact/runtime smoke test, not a browser visual-acceptance claim. A chosen-browser interaction and responsive pass remains the external visual boundary for final release acceptance.
