# NeoOracle Smart Contract Integration

NeoOracle (`service_id`: `neooracle`) is an **off-chain** HTTP fetch service running inside the TEE.

## Current Status (Platform Contracts)

There is **no dedicated platform contract** for NeoOracle in this repository’s current MiniApp Platform contract set. The canonical platform contracts live under:

- `../../../contracts/README.md`

NeoOracle responses are intended to be consumed via the gateway (Supabase Edge) and/or off-chain clients, with TEE-issued signatures used for verification/auditing as needed.

If you need an on-chain request/response pattern for oracle data, it should be implemented as a custom contract for your MiniApp (or added as a new platform contract) and then integrated with NeoOracle through the gateway.
