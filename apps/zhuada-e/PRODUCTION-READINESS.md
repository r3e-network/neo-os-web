# Goose Basket Shuffle · 鹅篮翻翻乐 — Production Readiness

Last reviewed: 2026-07-24

Package / manifest version: `3.1.0`

Current decision: **CONDITIONAL RELEASE CANDIDATE — physical-device gate still open**

This document separates repository automation and browser evidence from the evidence that can only be produced on real iOS/Android hardware. A green local build is necessary, but it is not sufficient for mobile release approval.

## 1. Release command

Run from `apps/zhuada-e`:

```bash
npm ci
npm run verify:release
```

`verify:release` is the authoritative local gate. It runs tests, ESLint, vendored-shim hygiene, the 24-level Monte-Carlo balance audit, the product release audit, the production dependency audit, deterministic art/audio regeneration through the `prebuild` lifecycle, asset verification, TypeScript checking, the production Vite build, the production bundle scan that rejects leaked Device QA or playtest debug runtime code, the gzip bundle budget gate for the entry, scene, Three.js and physics chunks, `npm run dist:digest` for a fresh release artifact hash, `npm run dist:stage` to synchronize the exact generated `dist/` tree into the host-served miniapp directory, and `npm run staged:verify` for staged host parity.

No release should be staged from a dirty or partially generated `public/` directory without rerunning this command.

Latest verified repository build (2026-07-24):

- Local release gate: test suite, ESLint, vendored-shim hygiene, balance audit, release audit, production dependency audit, asset gate, TypeScript, Vite build, production bundle scan and production bundle budget gate passed. Do not preserve hard-coded test counts here; they drift as coverage is added.
- Generated `dist/` tree digest: run `npm run dist:digest` after the production build and attach that output to the release record. Do not paste a dist digest into this document; it becomes stale whenever CSS, JS chunks, assets or Vite hashing change.
- The staged host tree is byte-identical to `dist/` and verified by `npm run staged:verify`; package, `neo-manifest.json`, and runtime `APP_VERSION` are all `3.1.0` and checked by `npm run assets:verify`.

## 2. Automated coverage

| Area | Automated evidence | Release meaning |
|---|---|---|
| Core game rules | `engine-zhuada.test.ts`, `guest-engine.test.ts`, `progress.test.ts` | Seven-slot matching, rescue rules, terminal outcomes, timed/untimed paths and all 24 levels draining to solved are regression-covered. |
| Long-level streaming | `item-stream.test.ts`, `guest-engine.test.ts`, `pile-density.test.ts` | 18–1,584 logical objects, complete-triple packets, 54-object challenge opening, deep refill at ≤18, +27 bottom layers and ≤54 live ceiling are asserted; L2 owns 864 objects and L3 owns 1,008, while each cycle visibly excavates before a substantial buried layer resurfaces. |
| Fresh balanced runs | `progress.test.ts`, `guest-engine.test.ts` | Every scene exposes a distinct 48-of-54 themed series. L1 selects a reproducible but replay-varying balanced three-kind tutorial; L2+ uses all 48 scene kinds. The first 54 bodies contain 12 authored silhouettes: six exact-silhouette near-match pairs plus six additional silhouettes, for 18 complete-triple identities. Another 30 identities are deferred to the reservoir. Packet order, family/treatment selection, placement and repeated late-level redeals remain non-fixed. |
| Physics catalogue | `physics-profiles.test.ts`, `model-cache.test.ts`, `render-quality.test.ts`, `themes.test.ts` | All three themes × 54 match identities have mass/surface/collision profiles. Each theme has 18 original authored model/icon recipes and 36 deliberate color treatments, making three independent identities per silhouette; variants use guaranteed full-body colour separation plus matching compact/standard/substantial size tiers in both 3D and tray, with no painted marker symbols. Bottle profiles retain a raised neck, crown seal and four-way label wrap after tumbling. Same-material authored parts are flattened to 2–7 runtime surfaces per item while retaining geometry/material detail, and the constrained tier reduces raster/shadow cost without changing the 54-body physics, picking, refill stream or rules. Geometry reuse does not share mutable materials or dispose shared buffers. |
| Picking | `pick-raycast.test.ts` | Recursive child-mesh hit resolution, nearest-surface ordering and item-root recovery are asserted. |
| Tray choreography and 3D motion | `tray-motion.test.ts`, `AnimatedTray.test.tsx`, `motion-quality.test.ts`, `scene-motion.ts` | Holes compact left, same-kind items group together, right-side items shift, triple matches visually land, highlight, clear and compact in separate timed phases, 3D pick flight and tray handoff share smooth easing, and the motion guardrail keeps tray movement on `translate3d`/opacity while locking 3D pick press, tray-flight arc, camera kick and pan-toss timings to readable capped values. |
| Motion detection | `device-motion.test.ts`, `shake-dynamics.test.ts` | Permission states, soft-pair/strong thresholds, hysteresis, refractory behavior, 0.65–1.35 mapping and impulse/velocity caps are asserted without pretending to emulate hardware sensors. |
| Audio logic | `sound.test.ts`, `scripts/verify-assets.mjs` | Cue table completeness, mute/unlock/fallback behavior, PCM headers, sample format and minimum duration are checked. |
| Persistence | `progress.test.ts`, `progress-store.test.ts`, `guest-engine.test.ts` | v1/v2→v3 migration, backup writes, future-version protection, mode-specific local records, 24h run snapshot TTL, resume and discard are covered. |
| UI/accessibility | `PlayArea.accessibility.test.tsx`, `ThreeGameComponent.test.tsx`, `scripts/release-audit.mjs` | Keyboard activation, semantic regions/live status, 44px touch targets, reduced motion, measured mobile game-fit sizing, immersive/compact mobile lobby composition and WebGL context-loss recovery are covered. |
| Content and reference compliance | `scripts/verify-assets.mjs`, `ASSET_PROVENANCE.md`, `REFERENCE-IMPLEMENTATION-COMPLIANCE.md` | 23 source hashes, 186 production images, alpha on all 162 item icons, nine transparent goose portraits, 15 PCM files, manifest/package/app-version parity, required notices, and public-reference no-copy/license boundaries are checked. |
| Balance | `scripts/tune.mjs` | The current 24-level curve and mathematical triple invariants are parsed from source and audited before release. |
| Dependency risk | `npm audit --omit=dev` | Production dependency advisories fail the release command. |
| Compile/package | `tsc --noEmit`, Vite build | Type errors or bundling failures fail the release command. |
| Bundle hygiene | `scripts/verify-production-bundle.mjs`, `scripts/verify-bundle-budget.mjs`, `scripts/verify-vendored-shims.mjs`, shared Vite chunks | Production runtime rejects leaked Device QA/playtest shortcuts, Three.js and cannon-es are split into cacheable chunks, and gzip budgets cover the entry, scene, Three.js and physics chunks. |
| Staged host parity | `scripts/sync-staged-dist.mjs`, `scripts/verify-staged-dist.mjs`, `npm run dist:stage`, `npm run staged:verify` | The host-served `platform/host-app/public/miniapps/zhuada-e` tree is replaced from the current `dist/`, then must match file-for-file and SHA-256-for-SHA-256 before release. |

Browser visual evidence is recorded separately in `design-qa.md` and `REFERENCE-VIDEO-AUDIT.md`. It currently covers 308×720 and 390×844 composition, three-theme consistency, top-view readability, one-tray layout, live/reserve behavior, staged tray motion, browser shake-button dynamics and visible frame-rate checks.

## 3. Resource and provenance status

### Visual assets

- 23 reviewed PNG masters live under `art-src/` and are pinned by SHA-256 in `art-src/SOURCE_MANIFEST.md`.
- The masters were generated specifically for this project with OpenAI ImageGen and then selected/refined locally.
- The workspace did not receive generation job IDs or verbatim prompts; provenance documents state this limitation explicitly.
- Runtime generation produces 186 checked production images: six logo/banner variants, three backdrops, three mascots, three container textures, nine transparent goose portraits and 162 transparent per-item icons.
- All nine collection portraits are optimized from reviewed PNG masters; chapter-2 portraits 7–9 replace the former flat procedural placeholders with the same layered, textured chibi material language as portraits 1–6. The production bundle gate requires all nine outputs.
- 54 authored runtime model recipes (18 per theme) are code-built multi-mesh 3D objects; 36 additional color identities per theme reuse matching authored geometry with independent full-body material colors, physics size tiers, localized label and hue-treated tray icon. This produces 162 gameplay match identities without falsely claiming 162 unrelated source models. Every authored silhouette has a three-identity near-match family. None are extracted GLTFs, commercial-game sprites or screenshot crops. The current model audit includes tumbling bottles with raised neck/cap/labels, transparent vessels with closed/thick bases and the night-market zongzi as a three-face layered leaf parcel with clean broad surfaces rather than painted marker lines.

### Audio assets

- `scripts/generate-audio.mjs` deterministically synthesizes 12 interaction cues and three six-second theme ambience loops.
- Runtime WAVs are mono 22.05kHz, 16-bit PCM and are checked by `scripts/verify-assets.mjs`.
- WebAudio synthesis remains a first-play/decode-failure fallback; the PCM bank is the primary shipped cue set.
- No commercial-game recording or third-party sample pack is included.

### Third-party software

- React/React DOM/Scheduler, Lucide, Noble hashes/curves, three.js and cannon-es notices are checked into `THIRD_PARTY_NOTICES.md` and copied into the public release asset `public/THIRD_PARTY_NOTICES.txt`.
- The asset gate rejects a public notice that omits any required runtime library or the applicable ISC/MIT license text.

### Reference implementation boundary

- `REFERENCE-IMPLEMENTATION-COMPLIANCE.md` records the current status of the named Juejin, CSDN and Gitee references.
- The current implementation uses the public references only for genre/mechanics comparison: 3D objects in an open container, raycast extraction, three-of-kind clearing, tray-full loss, and physics/shake interaction.
- The Gitee `hanshuoggg/big-goose` repository is excluded from production reuse because the currently reviewed page does not specify a license.
- The CSDN article is treated as a CC BY-SA learning reference; no article code, screenshots, textures or prose are copied into this app.
- The asset gate rejects a missing or weakened reference-compliance boundary.

## 4. Offline and network policy

The core run is local after the application bundle and assets have loaded: level generation, physics, matching, scoring, progress and resumable-run snapshots do not require a chain or API.

However, this release **does not claim offline support**:

- `neo-manifest.json` declares `features.offlineSupport: false`.
- There is no app-owned Service Worker or precache manifest.
- A first launch without network is unsupported, and an incomplete browser cache may omit images or PCM audio.
- The synthesized cue fallback may preserve some sound when a sample is unavailable, but it does not make the application an offline package.
- There is no wallet, leaderboard fetch or score submission in this release; the drawer reports only the device-local personal record.

If offline support becomes a product requirement, it needs a separately reviewed Service Worker/cache versioning strategy, storage-budget behavior, update invalidation, offline-first launch tests and manifest change. It must not be inferred from incidental browser caching.

## 5. Real-device release gate

The following evidence is still mandatory. The release status remains conditional until every row is recorded for at least one current iPhone and one representative mid-range Android phone.

Use a device QA build (`VITE_DEVICE_QA=1` with `?deviceQa=1`) and export the
local JSON report from the in-game Device QA panel. Build it with the exact
source commit that will be tested:

```bash
VITE_BUILD_SHA=<git-sha> npm run build:device-qa
```

`build:device-qa` first rejects missing, placeholder, or non-hex
`VITE_BUILD_SHA` values so a physical-device run cannot accidentally produce
`local-unbound` evidence. Every manual pass row must include an evidence path or
stable evidence id for the associated recording, trace, screenshot, or lab note;
otherwise `buildDeviceQaReport` keeps the verdict at `incomplete`. The
`fullFlow` row is stricter: the evidence or note must explicitly list
`fresh-market`, `farm-kitchen`, and `night-market`, so a single-theme smoke test
cannot be mistaken for three-theme release coverage. `npm run build:device-qa` regenerates the deterministic art/audio bank before asset verification and bundling, so physical-device evidence cannot be taken from a stale generated-resource set. It then runs `npm run bundle:verify:device-qa` to prove that `dist-device-qa/` contains the Device QA instrumentation and does not contain playtest shortcut actions, and to enforce the Device QA entry, scene, Three.js, physics and QA-panel gzip budgets.

Before the physical run, initialize a per-device local evidence bundle so every
manual gate has a folder and the exported JSON has a stable destination:

```bash
npm run device-qa:init -- ./evidence/device-iphone15-safari --build <git-sha> --device "iPhone 15 / iOS Safari"
npm run device-qa:init -- ./evidence/device-android-midrange-chrome --build <git-sha> --device "Android mid-range / Chrome"
```

The initializer writes `device-report.template.json`, `README.md`, and one
`evidence/<manual-check>/` directory per required manual row. The template is
intentionally `incomplete`; the in-game Device QA panel export and the offline
verifier are still the only acceptable pass evidence.

The exported JSON also records runtime feedback evidence: audio mute state,
AudioContext state, decoded SFX sample count, ambience state, haptic support and
whether the Device QA audio/haptic test buttons were used in the recorded run.
This does not replace the manual speaker/headphone and hand-feel checks; it
prevents a manual note from passing when the runtime was still muted, suspended,
missing decoded samples, or never exercised from the QA panel.

The exported JSON must also include runtime transition coverage, so a static or
partial recording cannot pass as a full game run. The in-game report and offline
verifier require `game-state`, `motion-signal`, `game-shake`,
`feedback-audio-test`, `feedback-haptic-test` when haptics are enabled, plus
game-state samples proving active play, a non-empty bottom reserve, and at least
one item entering the tray.

The exported JSON must also include structured stability evidence. The
`stability` block must record at least 20 start/retry/exit/resume cycles, one
long Level 15 run, `stability.memoryTimelineEvidence` pointing to the local
memory/GPU timeline, `memoryTrend=flat`, `restartSlowdown=none`, and
`contextLossLoop=false`. The offline verifier rejects missing stability
evidence, missing timeline files under `--strict-evidence-files`, monotonic
memory/GPU growth, progressively slower restarts, and context-loss loops.
The same JSON must prove foreground animation continuity: median FPS ≥55, P95
frame time ≤25ms, longest foreground frame ≤80ms, long-frame rate ≤0.6%, and
worst consecutive slow-frame burst ≤2 frames. This catches visible hitching
that an acceptable median FPS alone would hide.

After exporting the report, verify it offline before accepting the device run:

```bash
npm run bundle:verify:device-qa
npm run device-qa:verify -- path/to/device-report.json --evidence-root path/to/evidence-bundle
npm run device-qa:verify-suite -- ./evidence
```

Use `--strict-evidence-files` when every manual evidence value should resolve to
a local recording/trace/screenshot file. Without that flag, stable lab IDs are
allowed, while file-like evidence paths are still checked for existence. The
single-report command is a precheck. Release signoff requires the in-game
JSON verdict to be `pass`, the single-report verifier to accept each report, and
`npm run device-qa:verify-suite -- ./evidence` to accept the complete evidence
root. The suite verifier runs every report with `--strict-evidence-files` and
requires at least one accepted iOS/Safari report and one accepted Android/Chrome
report for the same app version and build id.

| Device-only gate | Minimum evidence | Pass condition |
|---|---|---|
| iOS motion permission | Screen recording from the visible Enable button through `requestPermission`, plus denied path | Granted path produces controlled tosses; denied path remains playable with the screen Shake button; no repeated unsolicited prompts. |
| Android motion delivery | Screen recording of `devicemotion`, disable/re-enable and no-event/blocked fallback | Sensor action is recognized while active; ordinary walking/rotation does not repeatedly fire; fallback appears if events are unavailable. |
| Toss calibration | Ten soft and ten strong gestures on each device | Soft gestures visibly disturb fewer objects; strong gestures never exceed caps, eject objects or create an unrecoverable pile. |
| Audio unlock/mix | Headphone or clean speaker capture covering first tap, dense collisions, match/combo, win/fail, shake, mute and theme ambience | No autoplay rejection visible to the player, no clipping or stacked collision burst, cue classes remain distinguishable, mute persists after reload. |
| Haptics | Physical observation of pick/match/win/fail/shake with haptics on/off | Supported Android behaves as designed; unsupported iOS/Safari path is silent and error-free; off state persists. |
| Frame time | 60-second performance trace at the 54-live-body ceiling with reserve, including refill, rapid picks and a strong toss | Target median ≥55 FPS, P95 frame time ≤25ms, longest foreground frame ≤80ms, long-frame rate ≤0.6%, and worst consecutive slow-frame burst ≤2 frames on the selected mid-range Android. |
| Memory/GPU stability | 20 start/retry/exit/resume cycles and at least one long L15 run, with memory timeline | No monotonic WebGL/geometry/audio/listener growth, context-loss loop or progressively slower restarts. |
| Background/resume | Timed and relaxed runs sent to background, restored, killed/reopened and resumed | Timed deadline excludes hidden time according to product rule; run snapshot restores within 24h; expired/corrupt snapshots fail safely. |
| Responsive input | 308×720-class and modern tall phone, portrait plus one rotation cycle | No horizontal scroll, tray/tools remain reachable, visible surface can be selected, 44px controls do not overlap system insets. |
| Full flow | Each theme: start → pick → match → refill → every tool → motion/fallback shake → win and loss → retry/resume; exported `fullFlow` evidence/note explicitly names `fresh-market`, `farm-kitchen`, `night-market` | No dead end, duplicate settlement, stale theme asset, missing audio/icon or inconsistent tray state. |

Evidence should record device model, OS/browser version, build hash, date, theme/level, whether reduced-motion and mute were enabled, and the trace/video path. The exported JSON must be stored with the evidence bundle, not summarized manually.

## 6. Current release decision

### Ready in repository/browser scope

- Three complete selectable themes and 162 gameplay match identities are wired end to end, backed by 54 original authored model/icon bases plus 108 intentional color variants. Nine scene bands each expose a different 48-of-54 series; L1 randomizes a balanced three-kind tutorial, then L2 jumps to 48 kinds / 864 items. Its first 54 bodies contain 12 authored silhouettes—six exact-silhouette near-match pairs plus six singletons—for 18 identities, with 30 more introduced through later bottom refills.
- The level curve, streamed reserve, random new-run generation, grouped/left-compacting tray rules, tools, progress v3 and interrupted-run resume have automated coverage.
- Deterministic image/audio generation, immutable source hashes, public notices, package/manifest parity, vendored-shim hygiene, dependency audit, type-check, production build, bundle leak scan, gzip bundle budgets and staged host parity are part of one release command.
- Browser design QA reports no open P0/P1/P2 visual defects for the audited viewports.

### Not yet sufficient for unconditional production release

- iOS/Android sensor permission and real accelerometer delivery have not been proven on hardware.
- Real speakers/headphones, real haptics, mid-range mobile P95 frame time and long-session memory/GPU behavior still need evidence.
- Offline support is intentionally false and must not be advertised.

**Decision:** ship only to an internal/device-validation channel until the real-device gate in Section 5 is complete. After evidence passes, rerun `npm run verify:release`, stage the exact generated `dist`, verify staged host parity plus package/manifest/runtime version parity, and then record the build hash here.
