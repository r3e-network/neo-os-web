# Burn League production status

Last read-only verification: 2026-07-11.

## Active paid deployment

Only Neo N3 TestNet is published as an active GameFi binding:

| Field | Verified value |
| --- | --- |
| Contract | `0x21a527b50b839efeb73721a886c9b5994a206316` |
| Name / id | `MiniAppBurnLeague` / `7372` |
| Update counter | `0` |
| Deployed NEF checksum | `1958350116` |
| Local artifact checksum | `1958350116` |
| Season duration | `86400000` ms (24 hours) |
| Current season / pool / GAS balance | `0 / 0 / 0` |

The deployed ABI contains the required `burn`, `settle`, `withdraw`, season,
leader, credit, and bounds methods plus `Credited`, `Burned`, `SeasonSettled`,
and `CreditWithdrawn` events. Guest play never touches wallet or chain APIs.

Burn League does not need Oracle VRF: the paid winner is selected
deterministically from on-chain totals, with the first player to reach a tied
total retaining the lead. Guest heat variation uses Web Crypto and fails closed.

## MainNet block

The legacy MainNet address
`0xdd3bf2ff39bc4e39107ace953e2271a43a58e28f` is a different artifact:

- checksum `1404779192`, update counter `0`;
- `seasonDuration() = 120000` ms (two-minute demo);
- no `getOwner` or `update` ABI;
- current season, pool, and GAS balance are all zero.

It has been removed from the active public manifest. A new reviewed MainNet
deployment is required; changing copy or bypassing the duration gate is not an
acceptable activation path.

## Financial safety model

- Wallet connection and irreversible burning require separate gestures.
- The first burn press arms a 12-second review; only the second submits.
- The wallet deposits only the prepaid-credit shortfall.
- Every deposit/burn txid is persisted by network, contract, and player before
  confirmation; ambiguous broadcasts block duplicates and can be rechecked.
- A matching event is not enough: player, amount, exact txid, and canonical
  credit/user-total readback must agree before success is shown.
- Failed post-deposit burns leave withdrawable credit; the app never auto-burns
  recovered credit after refresh.

Settlement and withdrawal still return an explicit unknown state when a
broadcast cannot be verified; they are never auto-replayed. A future shared
operation journal should extend exact-tx refresh recovery to those auxiliary
actions before a MainNet launch.

No deployment, transaction, contract update, or key access was performed in
this verification.
