# AA Account Lab

Register and inspect Neo Abstract Accounts against the shared AA core.

## What It Does

- derives or accepts a 20-byte `accountId` hash
- reads current verifier / hook / backup owner from the shared AA core
- submits `registerAccount` directly from a Neo wallet

## Scope

This miniapp is intentionally narrow. It is the registration and inspection entrypoint, not the full AA operations workspace.
