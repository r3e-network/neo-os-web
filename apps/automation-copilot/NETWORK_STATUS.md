# Automation Copilot network status

Read-only verification date: 2026-07-11. No wallet transaction was submitted.

## Mainnet

- RPC: `https://api.n3index.dev/mainnet`
- MorpheusDataFeed: `0x03013f49c42a14546c8bbe58f9d434c3517fccab`
- `TWELVEDATA:NEO-USD`: `HALT`, price integer `1967000`, source/record timestamp `1783766231`
- `TWELVEDATA:GAS-USD`: `HALT`, price integer `1048600`, source/record timestamp `1783766851`
- The canonical `AGG:*` records were all-zero placeholders, so the shared reader correctly fell back to the positive provider records.

Both provider records were within the app's 12-hour freshness gate at verification time.

## Testnet

- RPC: `https://api.n3index.dev/testnet`
- MorpheusDataFeed: `0x9bea75cf702f6afc09125aa6d22f082bfd2ee064`
- `TWELVEDATA:NEO-USD`: `HALT`, price integer `1966000`, source timestamp `1773073038`, record timestamp `1783767258`
- `TWELVEDATA:GAS-USD`: `HALT`, price integer `1039600`, source timestamp `1773432436`, record timestamp `1783672358`
- The canonical `AGG:*` records were all-zero placeholders here as well.

The testnet records had recent write timestamps but stale source timestamps. Automation Copilot uses the source timestamp and therefore refuses registration instead of presenting a recently rewritten stale quote as fresh.

## Gateway truth

`/api/edge/automation-triggers` can return local fallback metadata when the remote automation executor is unavailable. The MiniApp treats `local_automation_intent` as a non-running handoff and `local_automation_unavailable` as a failed remote read. It does not clear, pause, or delete verified triggers based on either fallback state.
