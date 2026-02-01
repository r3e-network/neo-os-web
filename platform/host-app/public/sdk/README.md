# SDK Assets

This folder contains the MiniApp bridge script used for communication between the host app and miniapps.

- Source: `packages/@neo/uniapp-sdk/`
- Bridge: `platform/host-app/public/sdk/miniapp-bridge.js`

## MiniApps Integration

MiniApps source code is now integrated directly in the monorepo at `miniapps/`.

To build and deploy miniapps:

```bash
# Build all miniapps
pnpm build:miniapps

# Copy built miniapps to host-app
pnpm postbuild:miniapps
```

Or run the full build which includes all platform components:

```bash
pnpm build
```
