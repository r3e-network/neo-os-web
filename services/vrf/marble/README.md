# NeoRand (VRF) Marble

`neorand` is a MarbleRun/EGo service that returns verifiable randomness proofs.

Endpoints:

- `POST /random` (service-auth recommended): generate randomness + proof, optionally anchor on-chain.
- `POST /verify` (public): verify a `(domain, payload, signature, pubkey)` tuple produced by `/random`.

In production, prefer using **GlobalSigner** (`GLOBALSIGNER_SERVICE_URL`) so this service does not hold long-lived
private key material locally. For local/dev testing, `VRF_PRIVATE_KEY` can be injected (32 bytes).

