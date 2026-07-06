# Skill-Game Miniapp Series — Design Notes

> **ARCHITECTURE (current, 2026-07 — supersedes the bespoke "TEE-signer" text
> below, kept as history).** All 8 games (Sudoku, 2048, Flappy Dash, Snake
> Bounty, Aim Master, Color Clash, Merge Kingdom, Pet Potion) integrate with the
> Morpheus oracle **generically**, with ZERO per-game code in the oracle. The
> oracle is a generic privacy-compute platform; each game is DATA.
>
> - **Worker (`neo-morpheus-oracle/workers/nitro-worker/src/game/`)**: a
>   game-agnostic "confidential session" host. `registry.js` loads an engine by
>   `(appId, engineHash)` from an operator whitelist (hash-pinned reviewed JS);
>   `abi.js` is the fixed engine ABI (`deal/applyOp/replay/score` + `descriptor`
>   holding every per-game constant); `session.js` has NO `appId` branch
>   (enforced by `no-appid-branch.test.mjs`). Generic routes
>   `/api/morpheus/session/{start,step,finalize}` — start/step are the direct
>   enclave interactive loop (reveal-per-move), finalize emits the 79-byte
>   RESULT CODEC. Engines wrap the unchanged deterministic cores.
> - **Kernel + contracts**: settlement rides the existing MorpheusOracle kernel
>   (`SubmitMiniAppRequest` → `FulfillRequest` verified vs the shared
>   RUNTIME_VERIFIER → `onMiniAppResult`). Each game contract carries the
>   function to run (`appId` / `"game.session"` / `"session.finalize"` +
>   engineHash) and has NO bespoke crypto: `StartGame` reserves + sets the
>   deadline; `FinalizeGame(gameId, sealedOpLogHex)` submits the kernel request;
>   `onMiniAppResult` parses the RESULT CODEC and runs the uniform settle body
>   (target/window/undo → payout → Solved leaderboard). Trust root = the kernel's
>   shared verifier (per-game `SetTeeSigner` deleted).
> - **Client**: one root-level `framework/logic/tee-session.ts` on the generic
>   `/api/morpheus/session/*` endpoints, sealing the finalize op-log with the
>   confidential envelope (like `private-transfer`). No per-game service.
> - **RESULT CODEC** (worker builds, contract parses, kernel hashes SHA256):
>   `0x02 || commitment(32) || answerHash(32) || elapsedMs(u64 BE) || undos(u8)
>   || score(u32 BE) || difficulty(u8)` = 79 bytes, cross-pinned by a golden
>   vector in the worker, relayer, and contract suites.
> - **ZKP**: Neo N3 CryptoLib has BLS12-381 pairings, so on-chain Groth16 is
>   *buildable*, but ZK proves computation-correctness, not human effort/timing
>   (doesn't stop bots) and still needs the TEE for private puzzle generation —
>   a future score-integrity option, not the anti-cheat mechanism.
> - **Adding game #N**: a new hash-pinned engine + descriptor in the worker
>   registry, a contract cloning the economics + kernel consumer, a client op
>   union — ZERO oracle-core edits.
>
> Anti-cheat is a TEE-trust property (the kernel re-verifies the final score from
> the sealed op-log; per-move timing is trusted to the enclave clock) — honestly
> no weaker than the prior per-game signer, just rooted in the shared kernel
> verifier. The sections below describe the earlier bespoke design (history).

Status: Sudoku Arena (`apps/sudoku` + `contracts/MiniAppSudoku`) and 2048 Rush
(`apps/game-2048` + `contracts/MiniAppGame2048`) implemented on the PRIVATE
TEE-settlement protocol (v2 — supersedes the launch beacon design): the puzzle
/spawn stream is generated inside the Morpheus enclave (worker game-session
service in neo-morpheus-oracle, `workers/nitro-worker/src/game/`), only its
SHA-256 commitment is bound on-chain (`bindPuzzle`, TEE-signed), gameplay ops
stream to the enclave (telemetry + undo ledger, no per-move txs), and
`settleVerified` pays only after checking the enclave's secp256r1 settlement
signature AND that the problem hash equals the bound commitment. Digest
layouts (BIND/SETTLE domains, uint256-BE gameId, stored-LE hash160s, network
magic LE4) are pinned by cross-language vectors in BOTH repos' test suites.
This document records the reusable pattern and the specs for follow-up titles
(Nonogram, Kakuro, Lights Out, …) — new titles should clone the v2 protocol.

## Rule zero: no duplication with the existing catalog

Before designing ANY new title, sweep the live catalog (`apps/*/neo-manifest.json`
descriptions + categories, `platform/host-app/public/miniapp-definitions/`, and
the neo-morpheus-oracle examples) for the same game or the same core mechanic.
The existing `games` catalog is entirely CHANCE/WAGER mechanics:

| Existing game | Core mechanic |
| --- | --- |
| dice-game | 1-in-6 dice wager, 5.7x payout |
| fogplay | coin flip wager |
| gasbox | gacha / mystery-box pulls |
| gas-lucky-pool, red-envelope | random-split GAS gifting |
| burn-league | burn-competition leaderboard (seasonal, winner-takes-pool) |
| last-survivor | countdown pot, last buyer wins |
| on-chain-tarot | card draws |
| daily-checkin | streak rewards |

Sudoku Arena deliberately opened the untouched SKILL-GAME niche: deterministic
puzzles, solve-time deadlines, fixed rewards, penalized undos, cumulative-
winnings ranking. 2048 Rush added the second distinct mechanic — PROCESS
verification (an on-chain move-log replay) instead of Sudoku's state
comparison. Follow-up titles must each add a DISTINCT mechanic (line-logic for
Nonogram, cross-sums for Kakuro, …) — never a re-skin of an existing app's
loop, and never a second app competing for the same loop.

## The shared "timed skill challenge" pattern

Sudoku Arena establishes a contract + frontend pattern that any deterministic,
verifiable puzzle can reuse:

1. **Entry → pool.** The player deposits a small entry fee (`OnNEP17Payment`,
   credit-only) and `startGame(player, difficulty)` moves it into the reward pool,
   reserving the full base reward from the free pool so every active game stays
   payable (GasBox-style reserved-pool solvency).
2. **Beacon-seeded deal.** `deal(gameId)` (permissionless, idempotent-guarded)
   derives `seed = SHA256(blockHash(commitIndex+1) || player || gameId)` once the
   beacon block is immutable. For skill games `BEACON_BLOCKS = 1` suffices:
   unlike wager games, grinding the seed cannot mint value — any seed still
   yields a challenge that must be solved within the same limits.
3. **Deterministic challenge expansion.** Client (TypeScript) and contract (C#)
   expand the same seed through the same byte-stream algorithm. Golden vectors
   embedded in BOTH test suites (`apps/shared/test/sudoku.engine.test.ts` and
   `contracts/__tests__/MiniAppSudokuTests.cs`) pin the two implementations
   together; drift is a fund-affecting bug and fails CI on either side.
4. **Timed, floored submission.** `submitSolution` enforces
   `dealtAt + minSolve <= now <= deadline`. The minimum-solve floor is the bot
   deterrent; the deadline is the challenge. Rewards are fixed per difficulty
   (0.1 / 0.5 / 1 GAS) minus penalties, credited pull-payment style and
   withdrawn via `withdraw(account)`.
5. **Penalized rescue.** `useUndo(gameId, player)` records an on-chain undo:
   −30% of the base reward each, max 3. The client enforces "placements are
   final" and reverts one move per confirmed undo. (The economics only bind
   honest clients — a bot never needs an undo — but the honest game is coherent
   and the reward math is on-chain.)
6. **Event-driven leaderboard.** `Solved(gameId, player, difficulty, elapsedMs,
   undos, payout, totalWon)` carries the player's cumulative winnings; the
   frontend rebuilds the global ranking by MAX(totalWon) per player (order
   independent), with only the top-1 stored on-chain (burn-league pattern).
7. **Housekeeping.** `expireGame` (permissionless) releases reservations past
   the deadline and refunds entries the beacon never dealt (DEAL_TTL); daily
   start caps + pause switch + owner-tunable config bound the faucet risk.

### Honest threat model

Machine-solvable puzzles cannot distinguish humans on-chain. The defenses are
economic: entry fees (pool-funded, entry ≈ 20% of reward), minimum solve times,
per-player daily caps, reserved-pool solvency, and an owner-funded pool that
bounds total emission. The provable-fairness claim is about the DEAL (neither
side can pick the puzzle), not about bot resistance — the docs and drawer copy
state this honestly.

### Roadmap: Morpheus VRF + TEE sealing

`PlatformGame.Oracle.cs` already demonstrates the full Morpheus request/callback
loop (context store per requestId, `requestType` validation, refund on oracle
failure). The upgrade path for server-private deals:

- `startGame` submits `SubmitMiniAppRequest(appId, "oracle.vrf",
  "random.generate", …)` instead of waiting for a beacon block.
- A TEE compute workflow generates the puzzle INSIDE the enclave, returns only
  the clue layout + `SHA256(solution || salt)`, and seals the full solution with
  the oracle key (X25519-HKDF-AES-GCM helpers already exist in
  `apps/shared/utils/morpheus-confidential-envelope.ts`).
- `submitSolution` verifies the hash commitment instead of re-deriving.

This removes the "client can derive the solution" property (the only thing the
beacon design gives up) at the cost of oracle latency (~15–40s), fees, and a
relayer dependency. Worth doing once a game's rewards justify it.

## 2048 Rush — implemented (`apps/game-2048` + `contracts/MiniAppGame2048`)

2048 differs from Sudoku in one fundamental way: the challenge is a PROCESS
(move sequence over random tile spawns), not a STATE. As built:

- **Determinism.** Tile spawns draw from a counter-mode SHA-256 stream:
  `block(k) = SHA256(seed || BE32(k))`, two bytes per spawn (position over the
  free cells in ascending order, then value — 4 on `byte % 10 == 0`, else 2).
  The whole game is a pure function of (seed, moveLog).
- **Verification.** `submitRun(gameId, player, moves)` takes the move log as an
  ASCII digit string ('0' up, '1' right, '2' down, '3' left; String args pass
  verbatim through every wallet, unlike the repo's mixed ByteArray encodings)
  and replays it in C# — cap 2,000 moves, each O(16) integer work. A move that
  does not change the board invalidates the run. `[Safe] replayRunOf` exposes
  the same replay as a diagnostic for independent verification. Golden vectors
  (8 probe runs + a solver-found 512 run) pin the TS/C# engines exactly like
  Sudoku's derivation vectors. TEE attestation stays the v2 path if move caps
  ever become limiting.
- **Reward shape.** Time-boxed tile targets: 512 within 4 min → 0.1 GAS
  (entry 0.02); 1024 within 8 min → 0.5 (entry 0.10); 2048 within 15 min → 1
  (entry 0.20). Min-solve floors 60/120/240s. Same entry/pool/reservation/
  leaderboard machinery, same `Solved` event shape (7 slots).
- **Undo economics.** Identical: each on-chain undo −30% of the base reward,
  max 3; the client trims the latest move (and its spawn) after the undo tx
  confirms, and only the move log persists locally so the stored run can never
  drift from what the contract will verify.
- **UI.** Swipe/arrow/d-pad board in the PlayStage v2 shell, tile-pop and
  charged-glow motion, the same clock-skew submit buffers as Sudoku, and full
  compliance with the game audits ("game-2048" added to the catalog list).

## Other candidates that fit the pattern cheaply

| Game | Challenge derivation | Verification | Notes |
| --- | --- | --- | --- |
| Nonogram | seed → pick from verified line-clue library (like Sudoku masks) | 81-cell state equality | closest clone of Sudoku's flow |
| Kakuro | seed → transform of base solved grids | state equality | needs a mask library with uniqueness proofs |
| Lights Out | seed → random solvable state (always solvable by construction) | replay ≤ 25 toggles | tiny move logs, trivial on-chain replay |
| 15-puzzle | seed → parity-checked shuffle | replay move log (≤ 400 moves) | add move-count tiers for skill grading |

Checklist for any new title (all gates auto-discover the app):
`apps/<slug>` scaffolding per Sudoku (manifest/package/index/vite/tsconfig,
public logo.jpg + banner.jpg with UNIQUE content hashes), locale en/zh for every
`t()` key, `--mx2-stage-floor` from the allowed set, no gradient/url background
on top-level `-scene` wrappers, engine + playarea tests in `apps/shared/test/`,
contract + tests per `contracts/MiniAppSudoku`, and a one-line addition to each
of: `game-experience.audit.test.ts` catalog, `OnNep17PaymentConventionTests`
MoneyContracts. After deployment, add `contracts.neo-n3-*` to `neo-manifest.json`
and re-run `scripts/generate-miniapp-contract-registry.mjs`.

## Arcade series (#5–#10) — Flappy Dash, Snake Bounty, Aim Master, Color Clash, Merge Kingdom, Pet Potion

Six crowd-pleaser titles built on the SAME private TEE-settlement protocol
(`bindPuzzle` → ops stream to the Morpheus enclave → `settleVerified`). They add
two verification models beyond Sudoku's state-compare and 2048's move-replay:

- **Reflex replay (flappy-dash, snake-bounty, aim-master).** 60fps games: the
  enclave reveals a seed/pattern, the client simulates locally, and the enclave
  REPLAYS the input op-log through a byte-identical engine twin
  (`apps/<slug>/src/logic/<slug>-engine.ts` ⇄ `workers/nitro-worker/src/game/
  engines/<slug>.js`) to compute the AUTHORITATIVE score, then applies a
  behavioural timing gate before signing. Score = pipes passed / apples eaten /
  rings hit.
- **Reveal-per-move (color-clash, merge-kingdom, pet-potion).** Turn-based, so
  the enclave never hands the client the future: Color Clash reveals one colour
  per completed round (start `view.sequence` is empty); Merge Kingdom reveals the
  next spawn per merge (2048-style); Pet Potion applies deterministic care deltas
  with real-time action spacing. Score = longest sequence / highest tile /
  happiness reached.

All six reuse the shared entry→pool-reservation→pull-payment→`Solved`-7-slot
leaderboard machinery, the −30%/max-3 enclave-tracked undo economics, per-
difficulty entry/reward (0.02→0.1 / 0.10→0.5 / 0.20→1 GAS), min-solve floors +
deadlines, daily caps, pause, and the Semi-backed PlayStage v2 shell. Worker
game-session handlers live in `neo-morpheus-oracle/workers/nitro-worker/src/game/`.

**Honest threat model.** Reflex/memory games can't perfectly distinguish humans
from bots on-chain; the enclave replay makes the SCORE unforgeable, progressive
reveal denies future state where the genre allows, and behavioural gates +
entry fees + daily caps + a bounded pool make farming unprofitable. Stated
plainly in each app's fairness drawer — not claimed bot-proof.
