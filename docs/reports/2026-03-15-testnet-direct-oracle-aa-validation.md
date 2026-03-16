# Testnet Direct Oracle + AA Validation

Date: 2026-03-15
Network: Neo N3 Testnet

## Purpose

This report records the current MiniApp-platform integration path:

- direct `neo-morpheus-oracle`
- direct `neo-abstract-account`

It exists to make clear that the platform's primary testnet path is:

- direct `neo-morpheus-oracle`
- direct `neo-abstract-account`

## Result

Direct testnet Oracle and direct testnet AA relay/paymaster are both working.

The cross-repo validation helper in this repo can now reproduce the preferred
path:

- `deploy/scripts/verify_cross_repo_testnet.sh`

## Direct Oracle Validation

Source runtime:

- Morpheus testnet public API:
  `https://28294e89d490924b79c85cdee057ce55723b3d56-3000.dstack-pha-prod9.phala.network`
- Morpheus Oracle contract:
  `0x4b882e94ed766807c4fd728768f972e13008ad52`

Validation:

- request tx:
  `0x2ae8cf6f8f124e960262c1a7bbc975803a96608816bcccf2346933c8ae3dc172`
- request id:
  `235`
- callback result:
  `success = true`
- extracted value:
  `2.925`

Latest replay through the cross-repo validation helper:

- request tx:
  `0x93a970a538b5793f33d17978cd89248adcb73d99e2fdb5ef68cd5501c47e365c`
- request id:
  `238`
- callback result:
  `success = true`
- extracted value:
  `2.897`

Conclusion:

- external Morpheus worker + relayer are healthy for the direct Oracle path
- direct callback fulfillment is working on testnet

## Direct AA + Paymaster Validation

Canonical AA testnet anchor:

- AA core:
  `0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38`
- Web3Auth verifier:
  `0xf2560a0db44bbb32d0a6919cf90a3d0643ad8e3d`

Paymaster policy status after correction:

- policy id:
  `testnet-aa`
- allowlisted target contracts now include:
  - legacy testnet AA core `0x9cbbfc969f94a5056fd6a658cab090bcb3604724`
  - current clean testnet AA core `0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38`

Live AA test account:

- relay / signing wallet:
  `NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX`
- WIF used for the successful live run:
  user-supplied funded testnet account

Validation transactions:

- `registerAccount`:
  `0x519a0a99f80e505c49b9c52abea78746929efeccab2d2a1e0b5a9acd0763fcd5`
- `updateVerifier`:
  `0xab0f922a67f6c982470f7509c665a1c26a43793d1c748e6f430997f0c8a52419`
- relay-backed `executeUserOp`:
  `0x2e622155382adbd0e577d98a432ac140fb04b2758a2ced656979b8a177a9679c`

Latest replay through the cross-repo validation helper:

- `updateVerifier`:
  `0xbc18da39ccc1b6e9362bd31ddb94e576802676e0773e3d88e134a8feff3289a4`
- relay-backed `executeUserOp`:
  `0x75535272af4332eec7543039a466c91f6f2586676204ed16b57a40884e969188`

Relay result:

- paymaster approval:
  `approved = true`
- target contract:
  `0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38`
- method:
  `executeUserOp`
- VM state:
  `HALT`

Conclusion:

- direct AA relay is working on testnet
- direct Morpheus paymaster pre-authorization is working on testnet
- the corrected paymaster configuration now supports the clean shared AA testnet anchor

## Platform Direction

The MiniApp platform is now treated as a direct Oracle / direct AA integration
layer, not as a second on-chain service bus.
