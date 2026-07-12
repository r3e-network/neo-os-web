# On-Chain Tarot VRF contract — implementation and TESTNET activation status

Date: 2026-07-11
Contract: `MiniAppTarotVrf`
Status: compiled and mock-E2E tested; **not deployed and not activated**

## Outcome

`MiniAppTarotVrf` is a new, independently deployable contract. It does not update or
replace the existing `MiniAppTarot` contract. It implements an asynchronous Morpheus
randomness flow with:

- a fixed 0.1 GAS reading fee held in a player credit ledger;
- a separate, admin-funded Oracle reserve that pays the live Morpheus request fee;
- player witness and one-pending-reading-per-player enforcement;
- readingId ↔ requestId mappings checked in both directions, plus a permanent request-ID
  tombstone that prevents an Oracle from recycling a settled ID;
- configured-Oracle-only callbacks and exact `vrf_random` routing;
- three distinct cards in `0..77`, selected with 16-bit rejection sampling;
- full reading persistence, player history and accounting queries;
- separate global/player completed-reading counters, so pending and refunded requests
  are never presented as completed spreads in the game HUD;
- full user reading-fee credit restoration after Oracle failure, malformed entropy or
  local expiry;
- permissionless expiry/cancellation plus callback-first expiry handling with
  replay-safe, exactly-once refund semantics;
- pull-payment withdrawal for unused credit;
- global reentrancy locking, lock-free guards on admin/payment mutations, and
  effects-before-interactions on every GAS transfer;
- two-step admin handover, delayed/paused Oracle replacement, and a committed delayed
  upgrade path.

The Morpheus lane currently returns 32 signed CSPRNG bytes. The project calls the lane
`vrf_random`, but it is not a formal proof-carrying VRF. Its randomness integrity rests
on the Morpheus runtime verifier and deployment trust tier. The Tarot contract does not
fall back to `Runtime.GetRandom`.

Current checked build receipt after the asynchronous frontend/counting integration:

- `MiniAppTarotVrf.nef` SHA-256:
  `940ad17df103c834db9224de38235496ce19d154b56b16c690ec8fd9f0fe36da`;
- `MiniAppTarotVrf.manifest.json` SHA-256:
  `da57e33613febe9c07a9de50d4724e77a7188c4d6b3aca7356980cfbfa15c016`;
- artifact/ABI gates: 5/5;
- focused contract and source-behavior tests: 19/19.

The dormant GameFi client now targets this ABI: exact `readingFee` and live
`currentOracleFee` reads, `miniapp-tarot-vrf:credit`, asynchronous
`requestReading`, pending-reading persistence, terminal `getReading` readback,
permissionless timeout recovery, and `withdrawAllCredit`. The public GameFi entry
remains disabled until a real deployment passes the live matrix below.

## Live Morpheus TESTNET audit

Canonical TESTNET kernel:

- script hash: `0x4b882e94ed766807c4fd728768f972e13008ad52`
- address: `NTT7sxdJmf24HWy11mxAjD8YCifcYZMvLT`
- network magic: `894710606`
- `getcontractstate` update counter observed on 2026-07-11: `8`
- compiler reported by the node: Neo.Compiler.CSharp 3.9.1
- `requestFee` observed through `invokefunction`: `1,000,000` base units = 0.01 GAS
- `accruedRequestFees` observed: `6,057,000,000` base units
- `admin()` observed: `NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`
  (`0x0c3146e78efc42bfb7d4cc2e06e3efd063c01c56`)

The live ABI is an older callback-generation ABI. Its relevant methods are:

| Method | Live TESTNET shape |
| --- | --- |
| `requestFee()` | safe Integer |
| `feeCreditOf(Hash160)` | safe Integer |
| `isAllowedCallback(Hash160)` | safe Boolean |
| `addAllowedCallback(Hash160)` | admin mutation |
| `requestFromCallback(Hash160,String,ByteArray,Hash160,String)` | callback-mediated request |
| `onNEP17Payment(Hash160,Integer,Any)` | GAS fee-credit deposit |

This deployed ABI does **not** expose the canonical source tree's newer
`registerMiniApp`, module grants, sponsorship controls or `expireStaleRequest` methods.
The canonical source reviewed at
`/Users/jinghuiliao/git/r3e/neo-morpheus-oracle/contracts/MorpheusOracle/` has those
newer MiniApp OS semantics, but they must not be assumed to exist at the TESTNET hash
until `getcontractstate` proves an upgrade.

### Fee payer behavior by generation

Current TESTNET generation:

1. `requestFromCallback` requires `Runtime.CallingScriptHash == callbackContract`.
2. The callback contract must already be in the kernel allowlist.
3. The request fee is always deducted from the callback contract's Morpheus fee credit.

Canonical source generation:

1. `requestFromCallback` resolves the registered app from its callback hash.
2. The calling contract must equal the app's registered callback contract.
3. The configured app fee payer is used when it has credit and sponsorship allows the
   requester; otherwise the requester must have fee credit.
4. Pending request fees are reserved and can be refunded by the kernel's expiry flow.

`MiniAppTarotVrf` is compatible with both generations. It tops up its own Morpheus fee
credit from the local Oracle reserve before requesting. Under the canonical generation,
the app registration must use the Tarot contract as both callback and fee payer.

Deployment alone is insufficient: the live Oracle admin (or a coordinated admin
transaction) must call `addAllowedCallback(newTarotHash)` before any wallet-funded
reading is exposed. The app remains guest-only until that authority and the complete
settlement matrix are available.

## Callback and outcome binding

Each request payload serializes:

1. domain `miniapp-tarot-vrf/request/v1`;
2. Tarot contract script hash;
3. `Runtime.GetNetwork()`;
4. configured Oracle hash;
5. request type `vrf_random`;
6. selected callback adapter (`onOracleResult` only for the pinned legacy TESTNET
   deployment, otherwise `onMiniAppResult`);
7. reading ID;
8. player hash;
9. request timestamp.

The contract stores `SHA256(payload)` with the pending reading. Callback settlement
requires all of the following:

- caller equals the currently configured Oracle;
- caller equals the Oracle stored on the reading;
- stored network equals the executing network;
- readingId → requestId and requestId → readingId mappings both agree;
- request ID still has its permanent seen/tombstone record and can never be reused by a
  later reading;
- the player's active-reading index points back to the same reading ID;
- status is still pending;
- operation/request type is exactly `vrf_random`;
- rich callbacks also match app ID, module ID and stored requester;
- callback adapter matches the adapter committed when the request was created;
- stored fee and request-time invariants are valid;
- the stored payload hash is exactly 32 bytes and equals a fresh recomputation from all
  nine committed fields above.

The card entropy is `SHA256(rawOracleResult || payloadHash)`. This binds the 32-byte
Oracle result to the contract, network, player and reading request before selection.
For each of the first three Fisher-Yates positions, a 16-bit candidate is accepted only
below the largest exact multiple of the remaining deck size. Rejected candidates are
skipped; there is no biased modulo fallback. If the 32-byte digest cannot produce three
accepted samples, the reading fee is credited back instead of weakening selection.

## Old and new callback adapters

- `onMiniAppResult(requestId, appId, moduleId, operation, requester, success, result,
  error)` is the canonical rich adapter. Requests use it everywhere except the one pinned
  legacy TESTNET Oracle deployment, and settlement requires that the reading committed to
  this adapter.
- `onOracleResult(requestId, requestType, success, result, error)` is the old adapter.
  It is hard-gated to network magic `894710606` and the canonical TESTNET hash
  `0x4b882e94...ad52`. A mock, alternate deployment or mainnet Oracle cannot use it.

The old live kernel has no permissionless request expiry. Therefore a Tarot reading can
expire locally while the kernel request remains pending. If the local refund is ordered
first, a later kernel callback is rejected by the deleted request mapping and terminal
reading status. If the kernel callback is ordered first after the local deadline, the
common callback path classifies the reading as expired and restores the full reading fee
instead of drawing cards. Both orderings therefore converge on one terminal refund.
The external Oracle fee remains spent; that loss is borne only by the Oracle reserve,
never by the user's refundable reading-fee ledger.

## Accounting model

The contract accounts for its GAS balance as:

`player credit liability + pending reading fees + earned revenue + Oracle reserve`

At request time:

- 0.1 GAS moves from player credit liability to pending fees;
- only the Morpheus fee-credit shortfall moves from Oracle reserve to the kernel.

At success with the currently observed 0.01 GAS Oracle fee:

- pending 0.1 GAS becomes 0.01 GAS Oracle-reserve replenishment plus 0.09 GAS revenue.

At Oracle failure or timeout:

- pending 0.1 GAS returns in full to player credit;
- the already-spent 0.01 GAS Oracle fee is not fabricated back into the reserve.

The `accounting()` safe method reports the native GAS balance, all four ledger buckets,
accounted total, surplus and solvency flag.

## ABI handoff

Primary write methods:

- `requestReading(player, maxOracleFee) -> readingId`
- `refundExpiredReading(readingId) -> amount`
- `cancelExpiredReading(readingId) -> amount`
- `withdrawCredit(account, amount) -> amount`
- `withdrawAllCredit(account) -> amount`
- `proposeAdmin(newAdmin)` / `acceptAdmin()`
- `setPaused(paused)`
- `proposeOracle(newOracle)` / `activateOracle()` / `cancelOracleProposal()`
- `proposeUpdate(nef, manifest)` / `update(nef, manifest)` /
  `cancelUpdateProposal()`
- `withdrawRevenue(to, amount)`
- `withdrawOracleReserve(to, amount)`

Primary safe queries:

- `readingFee`, `readingExpiryMs`, `currentOracleFee`, `currentOracleFeeCredit`
- `creditOf`, `activeReadingOf`, `requestIdForReading`, `readingIdForRequest`
- `requestIdSeen` for permanent replay/tombstone diagnostics
- `getReading`, `playerReadingCount`, `getPlayerReadings`
- `readingsCount`, `pendingCount`, `pendingFees`, `revenue`, `oracleReserve`
- `totalCreditLiability`, `accounting`, `integrationConfig`
- admin/Oracle proposal and activation state queries

Events:

- `Credited`, `OracleReserveFunded`
- `ReadingRequested`, `ReadingDrawn`, `ReadingRefunded`
- `CreditWithdrawn`, `RevenueWithdrawn`, `OracleReserveWithdrawn`
- `AdminProposed`, `AdminChanged`, `OracleProposed`, `OracleChanged`
- `PauseChanged`, `UpdateProposed`

## TESTNET activation prerequisites

Do not activate until every item below is proven against the live ABI.

1. Build `MiniAppTarotVrf.nef` and manifest with Neo.Compiler.CSharp 3.9.1. The build
   script rejects any other compiler version and compiles with checked arithmetic.
2. Re-query `getcontractstate(0x4b882e94...ad52)` immediately before activation.
3. Deploy `MiniAppTarotVrf` independently, passing the canonical Oracle Hash160 as
   deployment data. Do not update `MiniAppTarot` in place.
4. For the current old TESTNET ABI, the Morpheus admin must call
   `addAllowedCallback(<tarot-vrf-hash>)`; verify `isAllowedCallback` returns true.
5. If the kernel has upgraded to the canonical MiniApp OS ABI instead:
   - ensure active module `vrf_random` exists;
   - register app ID `on-chain-tarot-vrf`;
   - set app admin to the operator account;
   - set fee payer and callback contract to `<tarot-vrf-hash>`;
   - grant module `vrf_random` to the app;
   - do not enable sponsorship controls that would force player self-payment unless the
     product intentionally changes the fee model.
6. Query `requestFee`; verify it is non-negative and no greater than the 0.1 GAS reading
   fee. The user-signed `maxOracleFee` must match the displayed quote.
7. Fund the Tarot Oracle reserve using GAS memo `miniapp-tarot-vrf:oracle` from the
   current admin. Fund user credit only with `miniapp-tarot-vrf:credit`, in exact 0.1 GAS
   multiples.
8. Run one success, one Oracle failure and one local-expiry flow with disposable TESTNET
   funds. Verify events, both request mappings, all four accounting buckets, withdrawal,
   replay rejection and late-callback rejection.
9. Only after those checks should a frontend manifest point to the new contract hash.

No deployment, allowlist mutation, app registration, funding transaction or key access
was performed during this implementation.

## Build and verification

Run:

```bash
deploy/scripts/build_tarot_vrf.sh
```

Immediately before any TESTNET activation, run the read-only live ABI/fee preflight:

```bash
node deploy/scripts/verify_tarot_vrf_morpheus_testnet.mjs
```

It sends only `getversion`, `getcontractstate` and `invokefunction(requestFee)` RPC reads.
It contains no transaction builder, signer, WIF or private-key path and exits non-zero on
wrong network magic, unsupported ABI generation, any required method/type/safety drift,
callback signature drift or a request fee above the reading fee.

Individual gates:

```bash
DOTNET_ROOT=/opt/homebrew/opt/dotnet/libexec \
  ~/.dotnet/tools/nccs contracts/MiniAppTarotVrf/MiniAppTarotVrf.csproj \
  --checked --optimize=All --output contracts/build/

node --test deploy/scripts/lib/tarot_vrf_contract_artifact.test.mjs

dotnet test contracts/__tests__/NeoContracts.Tests.csproj -c Release \
  --filter 'FullyQualifiedName~MiniAppTarotVrf'
```

Mock E2E covers allowlist failure rollback, dynamic fee and reserve checks, rich callback
success, app/module/operation/requester/request-ID rejection, callback-adapter downgrade
rejection, three-card invariants, failure refund, malformed-result refund, permissionless
expiry, late/replay rejection, permanent request-ID recycling rejection, Oracle-change
pending guard, callback-first expiry refund, attempted Oracle-to-admin reentrancy,
two-party admin handover, pause
enforcement, pull withdrawal, and ledger solvency for both precredited-Oracle and
reserve-shortfall success/failure paths. The legacy callback acceptance path itself is
pinned by source and artifact gates
because adding a test-only bypass of the canonical TESTNET hash/network gate would be a
production backdoor.

## Remaining risks

- Current TESTNET Morpheus is still the old callback generation and lacks kernel-side
  expiry/reserved-fee accounting. Tarot protects the player but cannot reclaim that old
  kernel's spent request fee.
- The `vrf_random` lane is signed CSPRNG, not a proof-carrying VRF. Production should
  verify the intended enclave trust tier before marketing it as verifiable randomness.
- A sustained Oracle outage can consume the operator-funded reserve through failed or
  expired requests. The one-pending-per-player and global 100-pending cap bound concurrent
  exposure; operators must monitor reserve and pause requests during an incident.
- The old kernel's fulfillment signing domain predates the newer contract/network binding.
  Tarot adds its own caller, network, payload and bidirectional request binding, but a kernel
  upgrade to the canonical signature domain remains desirable.
- Request-ID tombstones intentionally retain one small storage key per reading. This is a
  bounded cost per paid request and is required to prevent late-callback aliasing if an
  Oracle ever reuses an ID.
