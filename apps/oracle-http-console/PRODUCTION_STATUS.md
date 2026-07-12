# Oracle HTTP Console production status

Version: `1.2.0`

Product direction:

- A visual source → extractor → draft-package pipeline is the dominant first-screen tool surface.
- Exact request fields live in the drawer and no generic manifest form is rendered.
- The product is explicitly a local payload builder, not a completed oracle request.
- The copied payload now uses the real Morpheus `json_path`, `target_chain`, URL,
  method, JSON-header and body field names expected by `/oracle/smart-fetch`.
- Familiar `$.data[0].price` input is normalized to the dot path the current
  worker executes (`data.0.price`); unsupported recursive/wildcard/filter syntax
  is rejected instead of being presented as ready.
- Public endpoints are validated consistently by both the visual surface and the
  preview kernel; credentials, fragments, local/private hosts, unsupported
  methods, oversized paths, malformed POST JSON and bodies above 32 KiB are rejected.
- The local identifier is now a network-and-route-bound SHA-256 draft digest.
  It remains explicitly separate from a worker signature, callback receipt or
  proof of submission.
- Editing any prepared input invalidates both the visible receipt and the host
  shell digest until the user prepares again. Reset clears both the fields and
  kernel tally; the secondary receipt action copies only the exact Morpheus
  payload matching the digest.
- The selected launch network resolves through the shared generated Morpheus
  registry. Testnet remains honestly marked as externally degraded because its
  public health response currently reports mainnet.
- The public manifest requests no wallet or blockchain permission and advertises
  offline local drafting rather than a fictional API state source.
- Generated warm launcher artwork and the existing in-app pipeline scene are
  documented in `ASSET_PROVENANCE.md`.

Verification evidence (2026-07-11):

- Focused Vitest: 44/44 assertions passed across config/business logic,
  PlayArea, dispatch/state integration and the shared preview kernel.
- TypeScript: `tsc --noEmit --incremental false` passed.
- ESLint: application source and the three Oracle HTTP focused test files passed
  with zero warnings.
- Production build: 3,571 modules transformed in 15.22 seconds. The app entry is
  191.09 kB (57.94 kB gzip); its scoped CSS is 107.04 kB (18.93 kB gzip), and
  crypto, React, UI and platform SDK code remain split into reusable chunks.
- Static smoke: all 18 emitted files returned HTTP 200 from an ephemeral local
  Node server; all index asset references resolved.
- Asset integrity: all 9 `public/` files are byte-identical in `dist/`; the
  generated masters, active raster hashes and visual inspection are documented
  in `ASSET_PROVENANCE.md`.
- DApp coverage gate: 77/77 MiniApps passed with zero failures.
- Shared Oracle-console companion gate: 2/2 subtests passed after aligning its
  HTTP, Seal and Compute action matchers with their handled dispatch calls.
- Host copy: the accepted production build is byte-identical to the host public
  MiniApp directory. The regenerated catalog remains 77/77 unique app IDs and
  slugs with one Oracle HTTP Console entry at version `1.2.0`.
