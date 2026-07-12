# AA Account Lab

AA Account Lab is the product-facing registration and inspection workspace for
Neo Abstract Accounts. The primary surface is an account-control object rather
than a parameter form: the user chooses a recovery strategy, binds a verifier
identity and backup owner, sees the deterministic `AccountId`, and then submits
one explicit registration action.

## Product flow

1. Connect the wallet that will become the backup owner.
2. Choose the 7, 30, or 90 day recovery strategy.
3. Open advanced account fields to supply the verifier identity and optional
   hook. The canonical Web3Auth verifier requires a complete 65-byte
   uncompressed secp256k1 public key (`04` plus 128 hex characters).
4. Review the derived `AccountId` in the primary account scene.
5. Register. The app persists the exact transaction id at broadcast time and
   reports success only after a HALT execution, an exact `AccountRegistered`
   event, and a complete AA Core readback all agree.
6. If the wallet or indexer closes during confirmation, reopen the app and use
   **Check confirmation**. Recovery reads the saved transaction; it never
   rebroadcasts the registration.

The inspector is intentionally secondary. It accepts an existing exact
20-byte `AccountId` and reads verifier, hook, backup owner, escape timelock, and
escape status as one complete snapshot. A failed field read is shown as an
error, never replaced with zero or empty state.

## Scope

This MiniApp owns account registration and inspection. Permission changes,
session keys, relay operations, and market operations live in their dedicated
AA MiniApps. Network and deployment evidence is recorded in
`NETWORK_STATUS.md`; production behavior and verification are recorded in
`PRODUCTION_STATUS.md`.
