# Event Ticket Pass production status

Version: `1.3.0`  
Reviewed: 2026-07-12

## Product result

- The pass is the primary application resource: users see a real ticket surface, QR token, activity route and gate verdict instead of a flat form wall.
- Event blueprints handle the common creation path; schedule, capacity, notes, transfer and evidence remain in progressive secondary panels.
- Public event discovery is honest. The deployed ABI has no purchase or attendee self-claim method, so the product describes organizer-issued passes and renders no fake Buy or Claim action.
- The organizer gate queue is reconstructed from the selected event's deterministic issued token IDs. It is separate from the connected wallet's personal holder inventory.
- Gate staff can choose an issued pass or paste/scan a token ID, review owner, seat, event activity and used state, then perform the single contextual check-in action.
- Existing warm ticket artwork, catalog banner and logo remain the visual source; foreground content uses opaque light surfaces and high-contrast text.

## Business correctness and recovery

- Reads and writes require an explicit wallet/launch network and the configured contract binding. Contract name, checksum `2976433161`, NEP-11 declaration, exact ABI, `symbol=TICKET` and `decimals=0` are checked before signing.
- Event and ticket detail responses must match the requested event ID or token ID; a stale/wrong response is rejected.
- Wallet, network, contract, selected event and scanned-token changes invalidate in-flight results before they can populate the current view.
- Create, issue, event activation, check-in and transfer share one write lock, preventing overlapping wallet prompts before a txid is journaled.
- Wallet connection and recovery also participate in that lock. A competing action now receives a clear busy result instead of silently returning while another wallet request is open.
- All standard `Hash160` write arguments use the framework's canonical address-to-script-hash builder, avoiding provider-specific interpretation of recipient addresses.
- Ticket issue rechecks organizer ownership, event activity and remaining supply. Check-in rechecks the ticket, event and organizer at the signature boundary. Transfer rechecks current token ownership and used state.
- Every broadcast stores the exact txid, network, contract, account and request identity. Create recovery also binds the notes field; it cannot confirm a same-name event with different saved content.
- A broadcast is not success until the expected event and authoritative state readback agree. A missing application log remains pending, VM `FAULT` is terminal, and canonical `HALT` without the expected contract event is terminal rather than an endless recovery loop.
- Recovery-record deletion is probed and read back. If cleanup storage fails after chain verification, the exact operation remains pending for a cleanup retry instead of resurfacing as an unexplained stale transaction later.
- Event IDs remain integer-safe as strings, and a zero-duration event is rejected before any wallet transaction is requested.

## Verification evidence

- Focused Vitest suites: `53/53` passed across logic, rendered PlayArea, production-contract and RPC attestation tests.
- Frontend structure gate: `1/1` passed.
- Cross-app locale parity gate: `79/79` passed.
- Stateful manifest truth gate: `16/16` passed.
- App TypeScript check: passed.
- Scoped ESLint for app source and focused tests: passed.
- Production build: passed; `1900` modules transformed.
- Main app chunk: `260.43 kB` (`76.59 kB` gzip).
- App stylesheet: `129.80 kB` (`22.29 kB` gzip).
- Static Vite-preview HTTP smoke: `16/16` built files returned HTTP 200 with non-empty bodies and appropriate content types.
- Local asset inspection accepted `pass-artwork.webp`, `banner.webp`, and `logo.webp` as warm, bright, ticket-specific resources.
- The only build messages were upstream Semi theme Sass `@import` deprecation warnings; no application compile error was emitted.

## Explicit boundaries

- No live RPC request, wallet prompt, signature, funded transaction, contract deploy/update, or test-token transfer was performed in this lane.
- The independently reviewed production `dist/` was copied to the host miniapp directory and verified byte-identical. The regenerated catalog contains 77 entries with 77 unique app IDs and exactly one Event Ticket `1.3.0` row.
- No Browser, Chrome, Playwright or Computer Use validation was permitted. Responsive rendering, keyboard/focus behavior, QR scanning ergonomics, wallet-extension UX and the complete create → issue → attendee wallet → gate journey remain browser acceptance work.
- The last recorded live chain evidence is dated 2026-07-11 and is documented as historical evidence in [NETWORK_STATUS.md](./NETWORK_STATUS.md); it was not refreshed here.
- Git staging, commits, resets and pushes were not performed.
