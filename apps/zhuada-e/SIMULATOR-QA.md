# Goose Basket Shuffle simulator QA

This file records local simulator evidence. It is useful for fast iteration and
for catching mobile-browser regressions before a physical-device pass.

It does not replace the physical Device QA release gate in
`PRODUCTION-READINESS.md`.

## Retained simulator evidence package

- Evidence JSON: `evidence/simulator/2026-07-25-ios-android.json`
- Verifier: `npm run simulator-qa:verify -- evidence/simulator/2026-07-25-ios-android.json`
- Retained simulator-evidence dist digest: `3125d989ff5a3babd1fe5c8c46878e54551975e85bb3f0abf5ac8ff1b619b114` (214 files; material-specific v4 skins, shape-led yarn art without the old diagonal needle, deep-excavation `54→18+27` reservoir rhythm, and automatic Android software-renderer compatibility detection).
- Current source/build dist digest: `40d2404813c610435653c19c76cc762256a33dc774edd923108394faff415f51` (214 files). It prevents oversized invisible tap proxies from selecting an obscured object, balances every randomized L2 opening across broad colour families, upgrades the eight material finishes to v5, and physically coaxes thin cards/wedges/trays toward a readable broad-face rest without snapping or disabling tumble/Shake. The farm-kitchen kettle now owns a genuine three-dimensional bail handle, spout, lid field and enamel ring that remain recognizable from the overhead camera instead of collapsing into a black slash; open cookware receives a restrained solver-driven authored-top correction when nearly sleeping. Current browser evidence at `/tmp/zhuada-product-audit-2026-07-25/` proves the repaired kettle silhouette, exact object-to-tray identity, and two additional picks accepted without an input lock (`1/7 -> 3/7`). iPhone 17 Pro / iOS 26.5 Safari rendered all three preceding current-source themes and accepted a real pick; because the kettle geometry changed after that run and the Android cold boot was rejected after System UI and Google Play Services ANRs, this digest still needs clean iOS and Android reruns before simulator signoff.
- iOS simulator: iPhone 17 Pro / iOS 26.5 Safari, real game surface visible.
- iOS proof includes rapid consecutive picks, shake fallback, randomized retry,
  and the in-game drawer remaining fully usable above Safari's bottom toolbar.
- Android emulator: `onegate_api36` / Android 36 / Chrome 133.0.6943.137 at
  `http://127.0.0.1:5175/?simQa=1` with `networkBridge: adb-reverse`.
- If the dev server is listening only on host `127.0.0.1`, use
  `adb -s emulator-5554 reverse tcp:5175 tcp:5175` and open
  `http://127.0.0.1:5175/?simQa=1` inside Android Chrome. Record
  `networkBridge: adb-reverse` plus the exact reverse command in the evidence.
- Android proof is not a static screenshot: the evidence requires the tray count
  to increase after a pick. The current rapid-pick run records `1 -> 4`, then
  verifies shake cooldown, physical redistribution, Remove-to-shelf, and a
  cross-zone triple settling back to one compact tray item.
- The current Android emulator advertises `Android Emulator OpenGL ES Translator`.
  Chrome exposes WebGL and readable framebuffer pixels on that path while its
  compositor presents a blank board. The production runtime now classifies this
  software/emulator renderer automatically and uses the real-asset compatibility
  pile backed by the authoritative game state; no DEV query parameter is needed.
  Normal hardware renderers still publish the positive non-empty render marker
  before the one-shot Android blank-board probe accepts the live WebGL scene.
  The emergency real-asset pile remains available for true blank boot.
- That session's final Android logcat crash buffer was empty; no `FATAL EXCEPTION`,
  `CONTEXT_LOST_WEBGL`, or Chromium fatal error was observed.

The 2026-07-12 JSON remains archived as the earlier fallback-path pass and is
not the current product conclusion. A clean retained evidence package is still
historical proof for its exact build digest, not proof that every host GPU driver
will reproduce the same result.

## Current source audit (2026-07-25)

- The current browser build shows the dense L2 top view, one integrated tray,
  and a readable `高亮了一个可消物品` hint toast. Hint emphasis is applied to
  the authored object itself (lift, scale and emissive pulse); no slash, cross,
  ring or identity stamp is painted over gameplay objects.
- The generated honey-jar and lucky-cat thumbnails now use their authored
  honeycomb/oval details instead of cross-shaped decoration. The source and
  staged host tree are identical at the digest above.
- Near-match variants now distribute colour families around the full hue wheel
  instead of applying the same fixed offset to every object. The three copies
  of each opening identity also start in separate pile sectors, preventing
  large free-match clumps without removing random physics or replay variety.
- Current-digest iOS replay: iPhone 17 Pro / iOS 26.5 Safari rendered all three
  themes and the real L2 WebGL board; selecting a visible purple cylinder moved
  the same object into the tray at
  `/tmp/zhuada-device-v4-2026-07-25/ios-night-market-picked.png`.
- Current-digest Android replay: Android 16/API 36 / Chrome 133 on
  `onegate_api36` loaded through `adb reverse tcp:5175 tcp:5175`, automatically
  entered the production real-asset compatibility pile, and accepted a primary
  action pick (`0/7 -> 1/7`, pile `18 -> 17`) at
  `/tmp/zhuada-device-v4-2026-07-25/android-auto-fallback-picked.png`.
  The compatibility path proves current rules, assets, layout and input. It does
  not sign off physical-device WebGL, Cannon physics performance, audio, haptics,
  or motion.
- When Android Chrome enters the real-asset DOM compatibility pile, the hidden
  Three/Cannon loop pauses; leaving that fallback resumes with a discarded clock
  delta so physics cannot jump or continue consuming GPU time underneath it.
- The bullets above are backed by the current browser/source build. The Android
  replay and iPhone 17 Pro / iOS 26.5 replay recorded below belong to the
  retained simulator digest and must be rerun before signing the current digest.
  Physical-device FPS, memory, audio, haptics and motion evidence remain their
  separate release gates against the digest above.

### Current Android replay (2026-07-25)

- Android 36 / Chrome 133.0.6943.137 / `onegate_api36` was reopened through
  `adb reverse tcp:5175 tcp:5175` at the current source URL. The first compositor
  frame briefly showed the emulator's `System UI isn't responding` dialog; after
  two UI-tree-derived `Wait` taps, Chrome recovered without a crash and the live
  Three.js/Cannon board rendered the dense farm-kitchen L2 opening.
- Current screenshots: dense settled pile
  `/tmp/zhuada-current-android-after-8s.png`, first accepted pot pick
  `/tmp/zhuada-android-pick2.png`, three rapid consecutive picks
  `/tmp/zhuada-android-rapid-picks.png`, and the completed shake redistribution
  `/tmp/zhuada-android-shake2-after.png`.
- The three rapid taps changed the visible tray from one item to four without a
  one-second input lock. The subsequent Shake button tap moved the physical pile
  and showed `Shake (2s)` cooldown; no hint or tray duplication occurred in the
  shake replay. The final Android crash buffer contained zero lines and no fatal,
  WebGL context-loss, or Chromium GPU-process exception was observed.
- This replay is current functional WebGL evidence for the marker-free models,
  not a sustained-performance sign-off: the emulator is SwiftShader. The current
  source was also replayed in iPhone 17 Pro / iOS 26.5 Safari after selecting the
  installed Xcode 26.5 developer directory explicitly. The QA theme is now
  validated and resolved before the guest engine creates its first deal; this
  closes the prior race where an already-active saved theme rejected the later
  switch. Fresh-market, farm-kitchen and night-market captures are
  `/tmp/zhuada-theme-stage-audit-2026-07-25/08-ios-fresh.png`,
  `/tmp/zhuada-theme-stage-audit-2026-07-25/09-ios-farm.png`, and
  `/tmp/zhuada-theme-stage-audit-2026-07-25/10-ios-night.png`. Current Android
  night-market WebGL before/after-pick frames are
  `/tmp/zhuada-theme-stage-audit-2026-07-25/16-android-night-settled.png` and
  `/tmp/zhuada-theme-stage-audit-2026-07-25/17-android-night-after-pick.png`;
  its crash buffer was empty. Physical-device FPS, memory,
  speaker audio, haptics and motion still require their release-gate runs.

## Previous diversity rerun (2026-07-23)

- Current source-state release gate: passed; production dist digest
  `2a3dd82c5ad02c86a19135611eb4ebeeb826e3b4cc8a4daa5f20897556dda1c2`
  across 106 files, with staged host parity verified.
- iOS simulator: iPhone 17 Pro / iOS 26.5 Safari at the current local source
  state. L1 visibly contains a large pumpkin, medium bread and small spoon while
  retaining the single integrated tray and tools:
  `/tmp/zhuada-audit-2026-07-23-pass4/25-ios-balanced-lan.png`.
- Android emulator: `onegate_api36` / Android 36 / Chrome 133.0.6943.137.
  This run's host-backed GPU process logged `GL_INVALID_ENUM`, failed command
  buffer creation and a GPU-process restart, while the WebGL canvas remained
  blank in the compositor.
- For that unstable emulator-driver run only, the URL used the DEV-gated
  `simQa=1&androidFallback=1` switch. The fallback uses the same production
  item art, randomized level state, size metadata, tray engine and controls; it
  is not present as an unconditional production route.
- Android interaction proof was derived from the current UI hierarchy and then
  tapped through `adb`: the tutorial advanced from step 1/3 to 2/3 and the
  selected jam jar settled into tray slot one:
  `/tmp/zhuada-audit-2026-07-23-pass4/32-android-after-pick.png`.
- This fallback pass proves mobile layout, real-asset size bands, item selection,
  tutorial progression and tray integration. It does **not** prove Android
  production WebGL, device motion, speaker audio, haptics or sustained frame
  pacing; those remain physical-device release gates.

## Prior 24-kind challenge run (archived, 2026-07-24)

- L2 now contains 24 scene kinds / 360 logical objects. The mobile surface
  exposes 54 live Cannon bodies and 306 reserve objects, with the scale visible
  in the progress strip rather than hidden in implementation details.
- iPhone 17 Pro / iOS 26.5 Safari rendered the real 54-body L2 pile, single tray
  and full tool row at `/tmp/zhuada-audit-2026-07-24-pass9/20-ios-24types.png`.
- Android 36 / Chrome cold-booted with `-gpu swiftshader` and rendered the live
  Three.js/Cannon L2 pile without the DEV fallback. The accepted settled frame
  is `/tmp/zhuada-audit-2026-07-24-pass9/26-android-after-search.png`.
- Four immediate keyboard-equivalent picks were accepted in 763ms over Chrome
  DevTools transport and settled into four tray slots:
  `/tmp/zhuada-audit-2026-07-24-pass9/27-android-l2-rapid-picks.png`.
- The Android crash buffer was empty. A warm emulator compositor attempt did
  expose the known host `SharedImageManager` mailbox defect; a snapshot-free
  SwiftShader cold boot recovered real WebGL. This remains emulator-driver
  evidence, not the required mid-range physical-device frame-time proof.

## Secure-origin sensor and sustained-stream rerun (2026-07-24)

- Android Chrome was moved from `10.0.2.2` to
  `http://127.0.0.1:5175/?simQa=1` through
  `adb -s emulator-5554 reverse tcp:5175 tcp:5175`. The loopback origin is a
  secure context, so the visible motion control changed from unavailable to
  `Enable`, then to `Phone shake is ready`.
- An emulator accelerometer pulse from `0:9.8:0` to `26:0:0` and back reached
  the real `devicemotion` listener: `shakeNonce` changed `0 -> 1`,
  `shakeStrength` reached `1.2366567041216485`, and the live status changed to
  `The pile got a good shake!`. This proves the Android browser sensor pipeline,
  permission UI, threshold mapping and gameplay action in the emulator; it is
  not a claim about a physical phone's hand feel.
- The sustained L2 run kept 54 live physics bodies while the bottom stream
  drained reserve `306 -> 216`, recorded 29 completed logical triples, four
  accepted sensor shakes, no dispatch timeout, a flat reported JS heap during
  the measured 60-second window, and no crash.
- The same run deliberately does **not** pass the release frame-time gate:
  snapshot-free SwiftShader reported about `4.5 FPS` with `p95 ≈ 533ms`.
  Main-thread task time remained low enough to identify the emulator software
  compositor/GPU path—not DOM layout—as the dominant limit. Same-material model
  parts were nevertheless merged from roughly 8–12 authored parts to an
  average 3.5 runtime surfaces, and a constrained renderer tier now reduces
  antialias/shadow/raster cost without reducing gameplay bodies or rules.
- Accepted post-refactor Android frame:
  `/tmp/zhuada-audit-2026-07-24-pass10-android-merged-low-tier.png`.
  Physical mid-range Android P50/P95, audio, haptics and 20-cycle memory proof
  remain open release gates.

## Archived 48-kind / 12-silhouette opening expansion (2026-07-24)

- Archived simulator production dist digest:
  `cedacb38cfc4488666129f6219003a7a82f26f53291d203277ebac49ac397af7`
  across 106 files; staged host parity is verified.
- The current ruleset doubles L2 variety to 48 identities and raises the run to
  864 logical items (`54 active + 810 reserve`), while the late-level maximum is
  1,584. The live Cannon ceiling remains 54.
- This capture predates the current density/colorway pass. It sampled twelve
  authored silhouettes: six supplied two independently matchable close
  treatments and six supplied one treatment each. Keep it as simulator proof
  for that exact digest, not as current visual proof.
- Automated catalog, stream, persistence, raycast, collider and all-level drain
  checks are the first acceptance layer. The exact expanded ruleset is visible
  in the current in-app browser frame
  `/tmp/zhuada-audit-2026-07-24-pass12/12-browser-final-48-kinds.jpg`, iPhone 17 Pro /
  iOS 26.5 Safari frame
  `/tmp/zhuada-audit-2026-07-24-pass12/04-ios-48-kinds-active.png`, and Android
  36 / Chrome / SwiftShader frame
  `/tmp/zhuada-audit-2026-07-24-pass12/10-android-48-kinds-active-clean.png`.
- The current twelve-silhouette browser frame is
  `/tmp/zhuada-audit-2026-07-24-pass13/05-l2-12-silhouettes.png`; three
  consecutive accepted picks are visible at
  `/tmp/zhuada-audit-2026-07-24-pass13/06-rapid-three-picks.png`.
- Final-source iPhone 17 Pro / iOS 26.5 Safari and Android 36 / Chrome /
  SwiftShader frames are `/tmp/zhuada-audit-2026-07-24-final/ios-final.png` and
  `/tmp/zhuada-audit-2026-07-24-final/android-l2-before-pick.png`. Two actual
  Android Web View taps moved two different items into the tray at
  `/tmp/zhuada-audit-2026-07-24-final/android-l2-after-pick2.png`; the final
  Android crash buffer was empty.
- The first mobile captures were rejected: iOS was still on a white loading
  frame, while Android showed a Pixel Launcher ANR. After simulator recovery,
  iOS completed and Android rendered the real pile after roughly 65 seconds.
  Android's final crash buffer was empty. This is functional simulator proof,
  not acceptable startup/performance evidence.
- Android Chrome stayed on the real Three.js/Cannon path with the DEV fallback
  disabled. One direct canvas tap changed the announced tray state from `0/7`
  to `1/7`; the post-pick frame is
  `/tmp/zhuada-audit-2026-07-24-pass12/11-android-after-pick.png`.
- The same current Android build received 4,171 real `devicemotion` deliveries
  during the captured window. An emulator acceleration pulse from `0:9.8:0` to
  `24:0:0` and back changed the live status to
  `The pile got a good shake!`, proving the sensor-to-gameplay pipeline survived
  the 48-kind expansion. This remains simulator sensor evidence, not physical
  hand-feel evidence.
- During the later CPU-saturated release job, the SwiftShader emulator's Chrome
  process recorded `Timed out waiting for GPU channel` and a native `SIGTRAP`.
  This was not a game JavaScript exception, but it means the emulator run does
  not qualify as sustained Android stability proof. The already-open physical
  mid-range Android frame-time/stability gate remains open.
- Prior 24-kind screenshots remain historical evidence only.

## Current density and colorway browser pass (2026-07-24)

- Current source/build dist digest: `e07c55cead1719ae77f1221a5b3ec7a95eac25c7097f518b02cd68bd4f77b875` (214 files); bundle scan, gzip budgets and staged host parity passed after the marker-noise cleanup.
- The opening composition is now small-item dominant: 14 small, 2 medium and 2 large bodies across 18 logical opening identities, with 30 later identities reserved for bottom-up refill. This fills the tray-like basket instead of leaving large floor gaps.
- Logical colorway assets are independent `item-00..53.webp` files. The 3D model material color, physical size tier and tray thumbnail palette are derived from the same logical kind; current static proof: `/tmp/zhuada-audit-current-2026-07-24/05-color-blocks.png`. The current local runtime proof shows the dense top-view pile and integrated tray without identity marker overlays at `/tmp/zhuada-audit-current-2026-07-24/09-no-marker-runtime.png`; the earlier rapid-pick check remains `/tmp/zhuada-audit-current-2026-07-24/07-rapid-pick.png`.
- All three selectable themes were cold-loaded at the mobile viewport with a live WebGL canvas and zero page errors; the comparative frame is `/tmp/zhuada-audit-current-2026-07-24/08-three-themes.png`.
- The retained iOS/Android JSON above is intentionally not relabeled as current: simulator rerun on the new asset set is still required before calling mobile visual evidence current.

## Minimum evidence contract

The simulator JSON must include:

- app version, local dev URL and latest `dist:digest`;
- all three theme IDs: `fresh-market`, `farm-kitchen`, `night-market`;
- iOS screenshot with game surface, top view, tray and single-tray layout;
- Android screenshot after a pick, explicit localhost bridge (`10.0.2.2`
  host-loopback or `adb reverse`), visible game surface, top view, tray,
  WebGL canvas presence and explicit fallback state;
- Android pick proof showing `trayCountAfter > trayCountBefore`.

Run with file checks enabled for local QA. Use `--no-file-check` only when
reviewing an archived report whose screenshots live in an external lab store.
