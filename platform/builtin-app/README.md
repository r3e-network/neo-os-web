# Built-in MiniApps (Module Federation Remote)

This Next.js app exposes the optional **Module Federation** remote for MiniApps.
The host app (`platform/host-app`) can consume it using the `builtin` remote name.

## Exposed Module

- `builtin/App` → `src/components/BuiltinApp`

## Local Development (Optional)

```bash
cd platform/builtin-app
npm install
npm run dev
```

The dev server runs on `http://localhost:3001`.

Configure the host app to load the remote:

```bash
NEXT_PUBLIC_MF_REMOTES=builtin@http://localhost:3001
```

Then start the host app (`platform/host-app`) and open:

- `http://localhost:3000/?entry_url=mf://builtin?app=builtin-price-ticker`

## Entry URL Scheme (Optional)

If you choose to use Module Federation, set MiniApp manifests to:

```
mf://builtin?app=<app_id>
```

Optional `view` parameter is also supported when opening the remote directly:

```
http://localhost:3001/?app=builtin-lottery
```
