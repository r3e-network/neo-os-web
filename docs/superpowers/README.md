# Architecture Specifications and Plans

This directory contains versioned architecture authority for the platform-contract program.

- `specs/` records target architecture, cross-repository interfaces, and durable design decisions.
- `plans/` records executable migration, audit, validation, and deployment runbooks.
- Local agent state belongs in `.superpowers/` or `.workbuddy/` and must not be committed here.

Documents in this directory must not contain private keys, WIF values, mnemonics, or other credentials. Testnet credentials are supplied through environment variables only, and every chain-writing workflow remains dry-run-first with an explicit confirmation gate.
