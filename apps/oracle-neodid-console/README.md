# Oracle NeoDID Console

Direct NeoDID resolver and provider-inspection console backed by the public Morpheus Oracle web API.

## What It Does

- resolves public Morpheus NeoDID documents and DID resolution payloads
- queries the public NeoDID provider catalog exposed by the Oracle stack
- shows the canonical Oracle / NeoDID deployment metadata for the selected network

## Why This Exists

- MiniApps need a lightweight way to inspect NeoDID service metadata without leaving the platform
- operators can verify public resolver state before wiring NeoDID-dependent flows into AA or other MiniApps
