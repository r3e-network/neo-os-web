# MiniApps

- `builtin/`: first-party MiniApps metadata and assets
- `templates/`: developer starter kits
- `_shared/`: shared, build-free helpers (e.g. SDK postMessage bridge)

Built-in manifests point to host manifest runtime (`mf://manifest?app=...`).
No uniapp static bundle export is required.

Note: host runtime renders from manifest schema/template specs (JSON/YAML/Markdown).
