# NFT Factory network status

Last read-only verification: 2026-07-11. This file records the verified state;
it does not claim that a deployment, mint, wallet signature, or funded test was
performed.

## Configured release identity

- Network: Neo N3 testnet only (`neo-n3-testnet`)
- Read endpoint: `https://api.n3index.dev/testnet`
- Factory contract: `0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49`
- Contract name: `MiniAppFactory`
- Template: `tpl.nep11.collection.v1`
- `getTemplate`: `HALT`
- Template registered: yes
- `HasArtifact`: `false`
- `deployArtifactFromTemplate`: absent from the deployed ABI
- `deploymentCount`: `1`

The one existing registry record observed on that date was an NEP-17 test
record with a zero deployed hash. It is not evidence of an NFT collection
contract.

The old shared metadata example at
`https://assets.neomini.app/nft/neo-builder-pass/` and token `.../1` returned
HTTP 404. NFT Factory therefore starts with an empty metadata origin unless an
explicit launch parameter supplies one.

## Product consequence

The supported production path is read-only planning plus an owner-wallet
commitment:

1. Validate collection inputs.
2. Read token #1 metadata and the configured Factory template.
3. Export a deterministic package.
4. Sign an exact commitment that binds the network, Factory contract, template,
   package id, digest, and canonical payload.

The app exposes no deployment or mint transaction. A complete write lane must
first add an upgraded creator-artifact ABI and a package-bound NEF/manifest
builder. It must then persist the broadcast transaction through a storage
roundtrip, recover without asking for another signature, confirm the exact
expected event, and read `getDeployment(packageId)` back with a non-zero
contract hash. Until all of those pieces exist, deployment remains locked and
no success result is claimed.
