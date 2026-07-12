# Goose Basket Shuffle simulator QA

This file records local simulator evidence. It is useful for fast iteration and
for catching mobile-browser regressions before a physical-device pass.

It does not replace the physical Device QA release gate in
`PRODUCTION-READINESS.md`.

## Current local simulator pass

- Evidence JSON: `evidence/simulator/2026-07-12-local-simulators.json`
- Verifier: `npm run simulator-qa:verify -- evidence/simulator/2026-07-12-local-simulators.json`
- iOS simulator: iPhone 17 Pro / iOS 26.5 Safari, real game surface visible.
- Android emulator: `onegate_api36` / Chrome 133 at `http://10.0.2.2:5174/?simQa=1`
  with `networkBridge: emulator-host-loopback`.
- If the dev server is listening only on host `127.0.0.1`, use
  `adb -s emulator-5554 reverse tcp:5174 tcp:5174` and open
  `http://127.0.0.1:5174/?simQa=1` inside Android Chrome. Record
  `networkBridge: adb-reverse` plus the exact reverse command in the evidence.
- Android proof is not a static screenshot: the evidence requires the tray count
  to increase after a pick. The current run records `0 -> 1`.
- Android emulator note: Chrome exposed a WebGL canvas, but the host GPU path
  produced a blank WebGL layer. The Android-only real-asset fallback pile was
  active and clickable, while preserving the same game state and tray dispatch.

## Minimum evidence contract

The simulator JSON must include:

- app version, local dev URL and latest `dist:digest`;
- all three theme IDs: `fresh-market`, `farm-kitchen`, `night-market`;
- iOS screenshot with game surface, top view, tray and single-tray layout;
- Android screenshot after a pick, explicit localhost bridge (`10.0.2.2`
  host-loopback or `adb reverse`), visible game surface, top view, tray,
  WebGL canvas presence and fallback state;
- Android pick proof showing `trayCountAfter > trayCountBefore`.

Run with file checks enabled for local QA. Use `--no-file-check` only when
reviewing an archived report whose screenshots live in an external lab store.
