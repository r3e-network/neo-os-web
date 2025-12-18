# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Note: this repository’s **current** architecture uses a Supabase Edge gateway and a
> small set of enclave services (see `README.md` and `docs/ARCHITECTURE.md`). Older
> docs/releases are preserved under `docs/legacy/` and `RELEASE_NOTES_v1.0.0.md`.

## [Unreleased]

### Added

- Sprint 1: Code quality baseline and security improvements
- Environment isolation configuration (development, testing, production)
- Unified error handling package (`infrastructure/errors`)
- Unified structured logging package (`infrastructure/logging`)
- Kubernetes secrets template (`k8s/secrets.yaml.template`)
- Supabase Edge gateway functions (auth/routing, API keys, secrets, gasbank, intents)
- Platform contracts for MiniApp flow (PaymentHub/Governance/PriceFeed/RandomnessLog/AppRegistry/AutomationAnchor)
- `txproxy` service for allowlisted tx signing/broadcast (single tx policy point)
- Product enclave services: `neofeeds`, `neooracle`, `neocompute`, `neoflow`
- Shared infrastructure packages under `infrastructure/` (chain, secrets, database, middleware, runtime, metrics)

### Changed

- Updated documentation for the current Supabase Edge + platform-contract architecture
- Standardized chain writes through `txproxy` with contract+method allowlisting
- Hardened outbound request policies (URL allowlists, SSRF mitigations) in strict identity/SGX mode

### Removed

- Legacy Go gateway binary (Supabase Edge is the public gateway)
- Legacy VRF (`neorand`) and NeoVault services (out of scope for current platform)
- Legacy on-chain gateway / per-service contract stack (replaced by platform contracts)

### Fixed

- Documentation and module consistency issues (empty/broken modules, incorrect service docs)

### Security

- Added strict identity/SGX-mode safeguards and safer defaults for internal services

## [0.1.0] - 2024-12-10

### Added

- Initial release with MarbleRun + EGo + Supabase + Vercel architecture
- 9 core services: Gateway, NeoRand (VRF), NeoVault, NeoOracle, NeoFlow, NeoAccounts (AccountPool), NeoCompute, NeoStore (Secrets), NeoFeeds
- Neo N3 smart contracts for service integration
- TEE protection with MarbleRun/EGo
- Remote attestation via MarbleRun
- Multi-tenant database with Row Level Security
- Deterministic Shared Seed Privacy NeoVault (v4.1)

### Security

- All services run inside EGo MarbleRun TEE
- Secrets never leave the TEE
- TLS termination inside TEE
- ECDSA secp256r1 (Neo N3 compatible)
- AES-256-GCM encryption
- HKDF key derivation
- VRF (ECVRF-P256-SHA256-TAI)

[Unreleased]: https://github.com/R3E-Network/service_layer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/R3E-Network/service_layer/releases/tag/v0.1.0
