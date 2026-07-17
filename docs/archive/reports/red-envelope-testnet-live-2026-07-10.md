# Red Envelope TestNet live validation — 2026-07-10

## Result

PASS. The bounded v1.1 contract was deployed only to Neo N3 TestNet and exercised with two configured test accounts.

- Contract: `0x5a5ecc80cd5225acd7431a5dd6f0e32bb9260a87`
- Deployment transaction: `06e2b0d48cd44da292f9c468e751f48d4172dd391f1f4ab7b4b13b6171f9d037`
- Manifest version: `1.1.0`
- Limits: 0.1–20 GAS in the app, maximum 20 GAS in the contract, 1–100 packets, 60–604,800 seconds
- Randomness disclosure: `Runtime.GetRandom`; no oracle or VRF; intentionally bounded low-stakes social use only

## Live flow

1. Creator deposited exactly 1 GAS with the required create memo; `creditOf` reached `100,000,000` base units.
2. Creator opened envelope #1 with two packets and a 3,600-second expiry.
3. Creator claimed packet one: `98,223,014` base units.
4. The second configured account claimed the final packet: `1,776,986` base units.
5. The two shares summed to exactly `100,000,000`; remaining amount was 0, opened count was 2, active was false, and best-luck amount matched the larger share.
6. Final contract GAS balance was 0; no envelope funds were stranded.

The previous MainNet address remains unchanged. It lacks the bounded v1.1 ABI, so the frontend pauses new envelope creation there while continuing to allow claim, reclaim, and credit withdrawal for existing users.

## Recovery/UI gate

Financial success is shown only after an exact tx event or authoritative exact-entity readback. Pending operations are persisted by network, contract, account, txid, and phase; disconnected financial actions never connect-and-spend in one gesture. The lucky-opening animation only runs after a confirmed claim.
