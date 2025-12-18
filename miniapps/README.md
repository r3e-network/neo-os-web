# MiniApps

- `builtin/`: first-party MiniApps maintained by this repo
- `community/`: templates and examples for external developers
- `templates/`: buildable starter kits (not exported to the host public folder)
- `_shared/`: shared, build-free helpers (e.g. SDK postMessage bridge)

This folder contains **static, build-free** MiniApp examples intended to be
served from a CDN and loaded by a host app (see `platform/host-app`).

Note: the host export script (`scripts/export_host_miniapps.sh`) intentionally
skips `miniapps/templates/` to avoid shipping full build toolchains inside the
host's `public/` folder.
