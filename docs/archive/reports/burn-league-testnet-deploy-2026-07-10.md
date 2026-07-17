# Burn League TestNet production-duration deployment — 2026-07-10

## Result

PASS. The two-minute demo economy was replaced in source with a 24-hour daily season and deployed only to Neo N3 TestNet.

- Contract: `0x21a527b50b839efeb73721a886c9b5994a206316`
- Deployment transaction: `324400f9bca45f0687dbdcf99e5bc60fa98cf4506811d0edecc8ab71c73ce292`
- Manifest version: `1.1.0`
- RPC `seasonDuration()`: `86,400,000` ms
- Contract tests: 4/4 passed
- App tests after economics gate: 23/23 passed

The TestNet app manifest now points to the v1.1 contract. MainNet remains on the legacy `0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f` deployment and was not written.

## Runtime safety

The app treats any season shorter than one hour as a demo deployment. On such a network it:

- blocks new burns in both the Phaser control gate and the composable write path;
- explains that the contract requires an upgrade;
- continues loading claimable credit so users retain the `withdraw` exit path.

This prevents the legacy two-minute MainNet contract from being presented as a production economy while keeping the verified TestNet daily season playable.
