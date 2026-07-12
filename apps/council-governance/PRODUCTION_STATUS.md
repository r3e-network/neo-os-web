# Council Governance Production Status

Version: `1.1.0`  
Status date: 2026-07-12

## Product result

- The primary surface is a bright Neo council chamber, not a generic form
  dashboard. The current proposal, semantic quorum/support meters, vote choice,
  and one primary action own the visual hierarchy.
- Proposal creation is represented as a motion dossier. Title/brief inputs,
  policy parameters, duration, proposal lists, history, wallet data, committee
  roster, and lifecycle actions stay in the secondary drawer.
- The old decorative CSS quorum ring and synthetic seat dots were removed.
  The app uses the real chamber resource, shared official NEO/GAS `CoinArt`, and
  Lucide interface icons.
- The Council drawer shows the selected network, exact NEO/GAS balances, one
  member/one-vote right, governance constants, and the native NEO committee.
  Candidate rows require a valid compressed secp256r1 public key and
  non-negative safe-integer vote weight before they render.

## Governance correctness and recovery

1. Mainnet and testnet contract hashes are selected from the current verified
   network; an unknown network cannot silently fall through to mainnet.
2. `isPaused`, committee size, quorum, threshold, and duration bounds must be
   read successfully before any write is enabled.
3. The deployed contracts consume duration as milliseconds despite historical
   `*Seconds` map keys. The former 3/7/14-day controls exceeded the live maximum;
   valid 2/15/30-minute options now remain inside `86,400`–`2,592,000`.
4. Account, network, eligibility, balance, vote-status, roster, and proposal
   requests are generation-scoped. Late responses from an old wallet or network
   cannot overwrite the user's newer selection.
5. Proposal enumeration is capped at the newest 100 rows and reads details in
   bounded groups of eight. Community mirror input is capped, text-bounded, and
   namespaced away from positive contract proposal IDs.
6. A partial contract page never replaces the last complete verified page.
   A refreshed selected proposal is rebound to the new row so stale lifecycle
   status cannot keep an old action enabled.
7. Proposal type, title/brief size, policy-method allowlist, decimal integer
   policy value, positive safe proposal ID, current ownership, and lifecycle
   state are validated before invoke.
8. The framework action surface and composable write guard prevent duplicate
   concurrent submission. A broadcast is journaled with network, contract,
   case-sensitive wallet identity, operation, exact create payload, and txid.
9. Success requires the exact expected event plus authoritative contract
   readback. Vote confirmation checks both `hasVoted` and exact `getVote`
   support; creation checks owner, type, title, description, policy value, and
   `expiryTime - createTime`.
10. Ambiguous writes remain primary recovery actions. Recovery scans at most
    five bounded event pages, verifies the same event/readback contract, and
    never turns a timeout into success. Confirmed writes remain visible as a
    compact on-chain confirmation state.

## Verification evidence

- Focused governance logic, persistence, account/network race, PlayArea,
  integration, and stateful-manifest suites: `25/25` tests passed.
- Scoped TypeScript and ESLint checks passed with zero errors or warnings.
- Production build: Vite `7.3.2`, `1,852` modules transformed, `4.61s`.
- Main app bundle: `235.09 kB` (`70.72 kB` gzip); stylesheet: `117.49 kB`
  (`20.60 kB` gzip).
- Shared chunks: platform SDK `95.08 kB` (`30.73 kB` gzip), React `141.84 kB`
  (`45.56 kB` gzip), UI JavaScript `32.49 kB` (`11.58 kB` gzip), noble crypto
  `6.19 kB` (`2.68 kB` gzip).
- Static HTTP smoke returned `200` and byte-identical content for all `16/16`
  emitted files. Public assets plus manifest matched source-to-dist for `9/9`
  comparisons.
- Source and emitted manifest SHA-256:
  `20a746350e488cd249598c384d7f2b0971902ce62e6bd49fd0f2bf9b6ccabc43`.
- Repository MiniApp dApp support verifier checked `77/77` entries with zero
  failures.
- Both live contract ABIs, pause flags, governance constants, proposal counts,
  testnet proposal timestamps, native candidates, and 21-key committees were
  rechecked through read-only N3Index RPC on 2026-07-12.
- The active chamber, catalog banner, logo, and retained legacy artwork were
  inspected directly from local source files. No browser/Playwright screenshot
  acceptance is claimed in this lane.
- The build reports only upstream Sass `@import` deprecation warnings from the
  shared Semi theme; there is no app-local build failure.

## Release boundary

The host copy was intentionally **not synchronized**. No deployment, wallet
signature, funded account use, transaction, secret access, Git staging, commit,
or reset was performed. Release-day operations still need an eligible council
wallet on both networks to exercise live create/vote/revoke/finalize/signature/
execute paths and a chosen-browser host/device visual check.
