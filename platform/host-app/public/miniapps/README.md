# Standalone MiniApp dApps

This directory is the generated static dApp export surface for `apps/*`.

- Platform detail pages keep using the native manifest runtime: `mf://manifest?app=<app_id>`.
- Each MiniApp also ships as a standalone web dApp at `/miniapps/<slug>/index.html`.
- `catalog.json` lists the generated standalone dApp URLs and manifest URLs.
- `onegate-catalog.json` exposes the same apps in OneGate's dApp catalog shape.

Do not edit generated bundles here. Update the source app under `apps/<slug>`, then run:

```bash
npm run verify:miniapp-dapps
npm run export:miniapp-dapps
```
