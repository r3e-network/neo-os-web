# Marble SDK Wrapper

This package is a thin SDK that wraps MarbleRun primitives for services:
- Loads Coordinator-injected TLS certs/CA and builds an mTLS HTTP client for cross-marble traffic.
- Exposes injected secrets via `Marble.Secret/UseSecret`.
- Surfaces enclave identity (report, UUID, marble type) to services.

We keep this layer even though MarbleRun is used because it provides:
1. A stable Go API inside services (tests and simulation can stub it).
2. A single place to translate environment injection (`MARBLE_CERT`, `MARBLE_KEY`, `MARBLE_ROOT_CA`, `MARBLE_SECRETS`, `MARBLE_UUID`) into usable clients/configs.
3. Enforcement of the official cross-marble communication path (mTLS via `Marble.HTTPClient`), rather than ad-hoc HTTP clients.
