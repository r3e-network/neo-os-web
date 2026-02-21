# MiniApps Build Output

This folder is the **build output target** for UniApp MiniApps.

## Source Location

The canonical MiniApp source code is located at:

```
miniapps-uniapp/apps/
```

Each app contains:

- `src/pages/` - Vue components
- `src/static/` - Static assets (icon.svg, banner.svg)
- `src/manifest.json` - App configuration

## Build Process

To build and export MiniApps to this directory:

```bash
cd miniapps-uniapp
pnpm build:all
```

## Do Not Edit

Files in this directory are auto-generated. Edit the source in `miniapps-uniapp/apps/` instead.
