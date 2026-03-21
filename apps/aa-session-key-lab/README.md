# AA Session Key Lab

Configure `SessionKeyVerifier` directly on-chain and inspect sponsorship state from a focused AA miniapp.

## What It Does

- derives the AA account id hash from an input seed or 20-byte hash
- generates a local compressed P-256 session key when needed
- submits `aaCore.callVerifier("setSessionKey", ...)` with real chain parameters
- checks sponsorship state
- requests sponsorship
