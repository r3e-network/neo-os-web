# Goose Basket Shuffle · 鹅篮翻翻乐

Production mini-game built with React, Three.js, and cannon-es. It uses an
original three-match extraction rule set, three selectable art themes, local
progress, optional timed play, generated sound effects, and an opt-in phone
motion pan-toss gesture. Long levels use a streamed bottom reservoir: 18–432
logical items back a run while only 40–54 real Cannon bodies are live, and
complete-triple refill waves emerge from under the pile as space is cleared.

## Local workflow

```bash
npm ci
npm test
npm run build
npm run dev
```

`npm run build` uses npm's `prebuild` lifecycle to regenerate every runtime
image and audio file from the checked-in sources before the build script itself
verifies all 75 image dimensions/alpha requirements and all 15 PCM audio
headers/durations, then type-checks and bundles. This makes a clean checkout
fail loudly if an approved source asset is missing or malformed.

Before staging a release, run the complete local gate:

```bash
npm run verify:release
```

It runs the full test suite, ESLint, the 24-level Monte-Carlo balance gate,
the product release audit, the production-dependency audit, deterministic asset
regeneration, the production build, and the production bundle scan that rejects
leaked Device QA or playtest debug runtime code. It also prints a fresh
`npm run dist:digest` artifact hash, synchronizes the exact generated `dist/`
tree into the host-served miniapp directory, then checks staged host parity.

For hardware QA builds, collect the in-game Device QA JSON and then verify the
evidence bundle offline:

```bash
VITE_BUILD_SHA=<git-sha> npm run build:device-qa
npm run device-qa:init -- ./evidence/device-iphone15-safari --build <git-sha> --device "iPhone 15 / iOS Safari"
npm run device-qa:init -- ./evidence/device-android-midrange-chrome --build <git-sha> --device "Android mid-range / Chrome"
npm run bundle:verify:device-qa
npm run device-qa:verify -- path/to/device-report.json --evidence-root path/to/evidence-bundle --strict-evidence-files
npm run device-qa:verify-suite -- ./evidence
```

`build:device-qa` rejects missing, placeholder, or non-hex `VITE_BUILD_SHA`
values before it generates the instrumented bundle, then runs the QA bundle
verifier after bundling. The standalone `bundle:verify:device-qa` command is
kept for CI and for rechecking a previous `dist-device-qa/` artifact.
`device-qa:init` creates the local-only report template, manual-check folders
and README for one physical device run; it does not mark the run as passed.
`device-qa:verify` is the strict single-report precheck; release signoff uses
`device-qa:verify-suite`, which requires accepted iOS/Safari and Android/Chrome
reports for the same build. The exported report must include runtime transition
coverage for real gameplay and feedback events: `game-state`, `motion-signal`,
`game-shake`, `feedback-audio-test`, `feedback-haptic-test` when haptics are
enabled, plus game-state samples proving active play, reserve items and tray
movement.
It must also include structured stability evidence: at least 20
start/retry/exit/resume cycles, one long Level 15 run, a
`stability.memoryTimelineEvidence` path, `memoryTrend=flat`,
`restartSlowdown=none`, and `contextLossLoop=false`.
Animation smoothness is measured in the same report: median FPS must stay at
or above 55, P95 frame time at or below 25ms, longest foreground frame at or
below 80ms, long-frame rate at or below 0.6%, and the worst consecutive
slow-frame burst at or below 2 frames.

## Input and privacy

- Pointer/touch selects objects; Enter or Space selects the highest available
  object for keyboard access.
- Level 3 contains 210 total items but opens with 48 live bodies. After roughly
  two triples are excavated, a mixed nine-item refill wave surfaces from the
  reserve. The live-body ceiling remains 54 on every level.
- Phone motion is disabled until the player presses the visible Enable button.
- Motion samples are processed in memory inside the current page. They are not
  persisted or uploaded.
- A visible Shake button remains available when sensor access is unsupported,
  blocked, denied, or cooling down.

## Content and licensing

The art and PCM audio are original project assets and do not contain files
extracted from a commercial game. Public "抓大鹅-like" tutorials/repositories
are treated as learning references only unless a future license review records
otherwise. See [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md),
[REFERENCE-IMPLEMENTATION-COMPLIANCE.md](./REFERENCE-IMPLEMENTATION-COMPLIANCE.md),
and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
