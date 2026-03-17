# Testnet Direct Oracle + AA Validation

Date: 2026-03-15
Network: Neo N3 Testnet

Refresh note on 2026-03-17:

- testnet Morpheus Oracle `updater` was corrected on-chain with tx `0x944d44a176f989aef282c4359647ae08db26890ef733365f0da6fdd9be4620eb`
- testnet Morpheus Oracle verifier public key was corrected on-chain with tx `0x6070d6b0684df3531a9b1b9d9bbd60b149cfdd08af02960afe837b7458f223c6`
- a fresh direct Oracle smoke succeeded with request tx `0x8c8b6f09de54aad0b1c5cb52a5627b2c3cd3b0a6324c006ffd8afdd7843e1d64` and request id `3877`
- a fresh cross-repo direct Oracle smoke succeeded with request tx `0x7203b7a4781237bb8f255766b56d4f2718cf12cf9b8e686383832e8e724b3ef6` and request id `3878`
- the stable direct AA + paymaster + relay replay succeeded with tx `0xa7beaa775bcf9fee4f077f41b4fa3cddc08a66ee8913187e30864d953c99b6dd`
- the stable cross-repo direct AA + paymaster + relay replay succeeded with tx `0xd433d9dbc435dc83835aa8ff7eb36e757d2a77499728ad6d09cb599044172e20`
- `AA_TEST_WIF` must control `PAYMASTER_ACCOUNT_ID` when using the stable allowlisted paymaster account path

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

Latest recovery replay on 2026-03-17:

- request tx:
  `0x7203b7a4781237bb8f255766b56d4f2718cf12cf9b8e686383832e8e724b3ef6`
- request id:
  `3878`
- callback result:
  `success = true`
- extracted value:
  `2.841`

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

Latest stable replay on 2026-03-17 using the canonical allowlisted test account:

- `updateVerifier`:
  `0xd54fe4813693df0f244ada1c1daf8966ba70d0ced76bcdefc5e9fa6ba05aab2d`
- relay-backed `executeUserOp`:
  `0xd433d9dbc435dc83835aa8ff7eb36e757d2a77499728ad6d09cb599044172e20`

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
- the corrected Oracle updater/verifier configuration now supports fresh direct callback fulfillment again on testnet

## Platform Direction

The MiniApp platform is now treated as a direct Oracle / direct AA integration
layer, not as a second on-chain service bus.
