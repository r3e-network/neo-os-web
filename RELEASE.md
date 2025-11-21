# Release Checklist

This project ships multiple artifacts: the Go backend binaries (`cmd/appserver`, `cmd/slctl`), the TypeScript Devpack SDK, and matching helper SDKs in Go/Rust/Python. Follow this checklist to cut a release.

## 1) Versioning and tagging
- Bump versions where needed:
  - TypeScript SDK: `sdk/devpack/package.json` version field.
  - Rust SDK: `sdk/rust/devpack/Cargo.toml` (and regenerate `Cargo.lock`).
  - Python SDK: `sdk/python/devpack/pyproject.toml`.
  - Go module: tag in git; no embedded version string.
  - Devpack runtime version: `internal/app/services/functions/devpack/runtime.js` `VERSION` constant (should match SDK versions).
- Update changelogs:
  - Root `CHANGELOG.md` (Unreleased → release section).
  - SDK changelogs under `sdk/*/devpack/CHANGELOG.md`.
- Create a git tag (e.g., `v0.6.0`) after all changes are committed.

## 2) Build and test
- Go: `go test ./...`
- TypeScript SDK: `npm install && npm run build && npm test` inside `sdk/devpack`.
- Rust SDK: `cargo test` inside `sdk/rust/devpack`.
- Python SDK: `python -m compileall sdk/python/devpack`.
- Optional: build dashboard/tests if required by release scope.

## 3) Publish SDKs
- TypeScript (npm):
  - From `sdk/devpack`, run `npm publish --access public` (ensure auth and version bump).
- Rust (crates.io):
  - From `sdk/rust/devpack`, `cargo publish` (ensure `readme` and metadata are correct).
- Python (PyPI):
  - From `sdk/python/devpack`, build and upload (`python -m build && twine upload dist/*`), ensure `README.md` is included via `pyproject.toml`.
- Go helpers:
  - Tag the repo; consumers import `github.com/R3E-Network/service_layer/sdk/go/devpack@vX.Y.Z`.

## 4) Binaries and container images
- Build binaries: `go build ./cmd/appserver ./cmd/slctl`.
- Build/push images if releasing container artifacts (ensure version tag matches git tag).

## 5) Documentation
- Ensure `docs/requirements.md` and `docs/examples/services.md` reflect released features.
- Update `README.md` examples if versions changed.

## 6) Post-release
- Push tags and commits: `git push && git push --tags`.
- Announce release notes referencing the changelog entries.
