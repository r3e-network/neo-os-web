# Service Layer API Examples

Pragmatic, copy-pasteable examples for each major service. Replace `<TOKEN>` with a valid bearer, `<TENANT>` with your tenant ID, and `<ACCOUNT_ID>` with your account ID.

All commands assume the appserver is running at `http://localhost:8080` and that you set:
```bash
export TOKEN=<TOKEN>
export TENANT=<TENANT_ID>   # omit only if your account is unscoped
```

## Accounts
```bash
curl -s -X POST http://localhost:8080/accounts \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: ${TENANT:-}" \
  -H "Content-Type: application/json" \
  -d '{"owner":"alice","metadata":{"tenant":"'"${TENANT:-}"'"}}'

curl -s -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: ${TENANT:-}" http://localhost:8080/accounts
```

## Secrets
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/secrets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"apiKey","value":"super-secret"}'
```

## Functions
```bash
FUNC_ID=$(curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/functions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"hello","runtime":"js","source":"(params,secrets)=>({echo:params.msg,secret:secrets.apiKey})","secrets":["apiKey"]}' | jq -r .ID)

curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/functions/$FUNC_ID/execute \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"msg":"hi"}'
```

## Automation
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/automation/jobs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"function_id":"'"$FUNC_ID"'","schedule":"*/5 * * * *"}'
```

## Oracle (HTTP adapter)
Create a source, request, fail, and retry:
```bash
SRC_ID=$(curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/sources \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"prices","url":"https://api.example.com","method":"GET"}' | jq -r .ID)

REQ_ID=$(curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/requests \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"data_source_id":"'"$SRC_ID"'","payload":"{}"}' | jq -r .ID)

# runner marks running/succeeded (requires X-Oracle-Runner-Token when runner
# tokens are configured; API token still required)
# configure runner tokens via env: export ORACLE_RUNNER_TOKENS=runner-secret
curl -s -X PATCH http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/requests/$REQ_ID \
  -H "Authorization: Bearer $TOKEN" -H "X-Oracle-Runner-Token: runner-secret" \
  -H "Content-Type: application/json" -d '{"status":"running"}'

curl -s -X PATCH http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/requests/$REQ_ID \
  -H "Authorization: Bearer $TOKEN" -H "X-Oracle-Runner-Token: runner-secret" \
  -H "Content-Type: application/json" -d '{"status":"failed","error":"upstream error"}'

# retry is allowed without runner token
curl -s -X PATCH http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/requests/$REQ_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"retry"}'

# slctl runner callback example (env-supplied runner tokens)
# export SERVICE_LAYER_TOKEN=$TOKEN
# export ORACLE_RUNNER_TOKENS=runner-secret
slctl oracle requests create --account <ACCOUNT_ID> --source "$SRC_ID" --token "$TOKEN" --payload '{}'
slctl oracle requests list --account <ACCOUNT_ID> --token "$TOKEN" --status pending --limit 1
REQ_ID=$(slctl oracle requests list --account <ACCOUNT_ID> --token "$TOKEN" --status pending --limit 1 | jq -r '.[0].ID')
curl -s -X PATCH http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/requests/$REQ_ID \
  -H "Authorization: Bearer $TOKEN" -H "X-Oracle-Runner-Token: runner-secret" \
  -H "Content-Type: application/json" -d '{"status":"running"}'

# paginate + filter
curl -i -H "Authorization: Bearer $TOKEN" "http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/requests?status=failed&limit=1"
```

## Datafeeds
Create a feed with per-feed aggregation (median|mean|min|max):
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/datafeeds \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"pair":"NEO/USD","decimals":8,"aggregation":"median","threshold_ppm":5000,"signer_set":["'"$TEST_WALLET"'"]}'
```

Submit signed updates:
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/datafeeds/<FEED_ID>/updates \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"round_id":1,"price":"12.34","signer":"'"$TEST_WALLET"'","signature":"sig"}'

curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/accounts/<ACCOUNT_ID>/datafeeds/<FEED_ID>/latest"
```

## Pricefeeds

Create a price feed with deviation-based publishing:
```bash
# Create feed: NEO/USD with 1% deviation threshold, 5m update interval, 1h heartbeat
FEED_ID=$(curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/pricefeeds \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-ID: ${TENANT:-}" \
  -H "Content-Type: application/json" \
  -d '{
    "base_asset": "NEO",
    "quote_asset": "USD",
    "deviation_percent": 1.0,
    "update_interval": "@every 5m",
    "heartbeat_interval": "@every 1h"
  }' | jq -r .ID)
```

### Push price feeds on-chain
- Use the TypeScript/Go helpers under `examples/neo-privnet-contract*` to fetch the latest snapshot and call your contract (default method `updatePrice` on privnet). See `docs/blockchain-contracts.md` for end-to-end wiring with self-hosted Supabase + privnet.

Submit price observations:
```bash
# Submit observation (creates/finalizes rounds based on deviation)
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/pricefeeds/$FEED_ID/snapshots \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"price": 12.34, "source": "binance", "collected_at": "2025-01-15T10:30:00Z"}'

# List snapshots
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/accounts/<ACCOUNT_ID>/pricefeeds/$FEED_ID/snapshots"
```

Update feed settings:
```bash
# Update deviation threshold and disable feed
curl -s -X PATCH http://localhost:8080/accounts/<ACCOUNT_ID>/pricefeeds/$FEED_ID \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deviation_percent": 0.5, "active": false}'
```

See [Price Feeds Quickstart](pricefeeds.md) for the complete guide.

## Gasbank
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/gasbank/deposit \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":5.0,"tx_id":"tx123"}'

curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/gasbank/withdraw \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":1.0,"to_address":"ADDR"}'
```

## Data Streams
```bash
STREAM_ID=$(curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/datastreams \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"ticker","symbol":"TCKR","description":"demo stream","frequency":"1s","sla_ms":50,"status":"active"}' | jq -r .ID)

curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/datastreams/$STREAM_ID/frames \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sequence":1,"payload":{"price":123.45},"latency_ms":10,"status":"delivered"}'

curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/accounts/<ACCOUNT_ID>/datastreams/$STREAM_ID/frames?limit=5"
```

## DataLink
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/workspace-wallets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"wallet_address":"<WALLET>","label":"link-signer","status":"active"}'

CH_ID=$(curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/datalink/channels \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"provider-1","endpoint":"https://api.provider.test","signer_set":["<WALLET>"],"status":"active"}' | jq -r .ID)

curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/datalink/channels/$CH_ID/deliveries \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"payload":{"data":"hello"},"metadata":{"trace":"123"}}'

curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/accounts/<ACCOUNT_ID>/datalink/deliveries?limit=5"
```

## Randomness

Devpack action (inside a function):
```js
const rand = Devpack.random.generate({ length: 64, requestId: "example" });
return Devpack.respond.success({ action: rand.asResult() });
```

HTTP/CLI calls:
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/random \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"length":32,"request_id":"example"}'
```

## Devpack Quick Actions (inside functions)

```js
// Data feeds: submit signer update
Devpack.dataFeeds.submitUpdate({ feedId: "feed-1", roundId: 1, price: "12.34" });
// Data streams: publish a frame
Devpack.dataStreams.publishFrame({ streamId: "stream-1", sequence: 42, payload: { price: 99.1 } });
// DataLink: enqueue delivery to a channel
Devpack.dataLink.createDelivery({ channelId: "channel-1", payload: { foo: "bar" }, metadata: { trace: "abc" } });
```

## CLI equivalents (slctl)
```bash
slctl accounts list --token "$TOKEN"
slctl oracle requests list --account <ACCOUNT_ID> --token "$TOKEN" --status failed --limit 5
slctl oracle requests retry --account <ACCOUNT_ID> --token "$TOKEN" --id "$REQ_ID"
slctl gasbank deposit --account <ACCOUNT_ID> --token "$TOKEN" --amount 5
slctl random generate --account <ACCOUNT_ID> --token "$TOKEN" --length 16
slctl datastreams create --account <ACCOUNT_ID> --name ticker --symbol TCKR --frequency 1s --status active
slctl datastreams publish --account <ACCOUNT_ID> --stream <STREAM_ID> --sequence 1 --payload '{"price":123.45}'
slctl datalink channel-create --account <ACCOUNT_ID> --name provider-1 --endpoint https://api.provider.test --signers WALLET1
slctl datalink deliver --account <ACCOUNT_ID> --channel <CHANNEL_ID> --payload '{"data":"hello"}'
```

## SDK blockchain flows (Neo privnet)

TypeScript (privnet stack from `make run-neo`):
```ts
import { ServiceLayerClient } from '@service-layer/client';
const sl = new ServiceLayerClient({ baseURL: 'http://localhost:8080', token: 'dev-token', tenantID: '<TENANT>' });

// Oracle: source -> request -> mark running -> retry
const source = await sl.oracle.createSource('<ACCOUNT_ID>', { name: 'prices', url: 'https://oracle.test', method: 'GET' });
const req = await sl.oracle.createRequest('<ACCOUNT_ID>', { data_source_id: source.ID, payload: '{}' });
await sl.oracle.updateRequest('<ACCOUNT_ID>', req.ID, { status: 'running' });
await sl.oracle.updateRequest('<ACCOUNT_ID>', req.ID, { status: 'retry' });

// VRF: key + request
const key = await sl.vrf.createKey('<ACCOUNT_ID>', { label: 'privnet-key' });
const vrfReq = await sl.vrf.createRequest('<ACCOUNT_ID>', key.ID, { consumer: 'dapp-A', seed: 'seed-123' });

// CCIP: lane + message (cross-chain style payload)
const lane = await sl.ccip.createLane('<ACCOUNT_ID>', { name: 'privnet-lane', source_chain: 'neo-priv', dest_chain: 'neo-priv', signer_set: ['<WALLET>'] });
const msg = await sl.ccip.sendMessage('<ACCOUNT_ID>', lane.ID, { payload: { action: 'mint', amount: '100' }, metadata: { trace: 'abc' } });
console.log(source.ID, vrfReq.ID, msg.ID);
```

Go:
```go
package main

import (
	"context"
	"fmt"

	sl "github.com/R3E-Network/service_layer/sdk/go/client"
)

func main() {
	ctx := context.Background()
	client := sl.New(sl.Config{BaseURL: "http://localhost:8080", Token: "dev-token", TenantID: "<TENANT>"})

	// Oracle
	src, _ := client.Oracle.CreateSource(ctx, "<ACCOUNT_ID>", sl.CreateSourceParams{Name: "prices", URL: "https://oracle.test", Method: "GET"})
	req, _ := client.Oracle.CreateRequest(ctx, "<ACCOUNT_ID>", sl.CreateOracleRequestParams{DataSourceID: src.ID, Payload: "{}"})
	_, _ = client.Oracle.UpdateRequest(ctx, "<ACCOUNT_ID>", req.ID, sl.UpdateOracleRequestParams{Status: "running"})

	// VRF
	key, _ := client.VRF.CreateKey(ctx, "<ACCOUNT_ID>", sl.CreateVRFKeyParams{Label: "privnet"})
	vrfReq, _ := client.VRF.CreateRequest(ctx, "<ACCOUNT_ID>", key.ID, sl.CreateVRFRequestParams{Consumer: "dapp-A", Seed: "seed-123"})

	// CCIP
	lane, _ := client.CCIP.CreateLane(ctx, "<ACCOUNT_ID>", sl.CreateLaneParams{Name: "privnet", SourceChain: "neo-priv", DestChain: "neo-priv", SignerSet: []string{"<WALLET>"}})
	msg, _ := client.CCIP.SendMessage(ctx, "<ACCOUNT_ID>", lane.ID, sl.SendCCIPMessageParams{Payload: map[string]any{"action": "mint", "amount": "100"}})

	fmt.Println(src.ID, vrfReq.ID, msg.ID)
}
```

See `examples/neo-privnet-contract/` (TypeScript) and `examples/neo-privnet-contract-go/` (Go) for end-to-end helpers that pull a price feed snapshot and invoke a privnet contract.

## Discover services via the system APIs (engine-as-OS)
- The Service Engine is the “OS”; services are apps. `/system/status` shows how
  modules plug into the standard surfaces. To see which modules expose which
  surfaces, fetch `modules_api_summary`:
  ```bash
  curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/system/status | jq '.modules_api_summary'
  ```
  You will see groups like `compute`, `data`, `event`, `store`, `account`, plus
  any custom surfaces advertised via `APIDescriber`.
- Per-module entries under `.modules[]` include `interfaces`, `apis`, and
  `permissions`, so you can confirm a service is wired through the engine buses
  instead of bespoke cross-calls.
- CLI: `slctl status --surface compute --token $TOKEN` filters modules to a
  specific system API surface (compute/data/event/store/account/etc.).
- Dashboard: you can pin a surface via `?surface=compute` in the URL or by
  clicking the surface tags in System Overview; the filter persists in
  `localStorage` so you can share links for a given surface.
- Export: `slctl status --export modules.json` (or `.yaml` / `.csv`) writes the
  current module list, respecting `--surface` when provided. Use `--export -`
  to print JSON to stdout for piping/automation.
- Dashboard export: the System Overview “Export JSON/CSV” buttons download the
  current (filtered) module list directly from the UI.

## Dashboard quick start (privnet)
- Start the stack with `make run-neo` (API 8080, Dashboard 8081, Neo privnet RPC 20332).
- Open `http://localhost:8081/?api=http://localhost:8080&token=dev-token&tenant=<TENANT>` to prefill credentials.
- In Settings, leave the base URL/token/tenant prefilled; enable the “NEO” panel to see indexed height and storage snapshots.
- The Modules view lists the “OS” services; red/yellow badges show readiness or slow-start warnings. Click a module to see its exposed surfaces (compute/data/event/store/etc.).
- The NEO panel lets you inspect height/hash/state root, download snapshots, and verify manifests/diffs without leaving the dashboard.

## Contract invocation (Neo privnet, TypeScript)

Use the SDK for off-chain prep, then invoke a contract on privnet with `@cityofzion/neon-js`. This example fetches a price via Oracle/CCIP-style payload and calls a contract method.

```ts
import { rpc, sc, u, wallet } from '@cityofzion/neon-js';
import { ServiceLayerClient } from '@service-layer/client';

const sl = new ServiceLayerClient({ baseURL: 'http://localhost:8080', token: 'dev-token', tenantID: '<TENANT>' });
const rpcClient = new rpc.RPCClient('http://localhost:20332');

async function main() {
  // Off-chain fetch via Oracle
  const source = await sl.oracle.createSource('<ACCOUNT_ID>', { name: 'prices', url: 'https://api.example.com', method: 'GET' });
  const req = await sl.oracle.createRequest('<ACCOUNT_ID>', { data_source_id: source.ID, payload: '{}' });
  const latest = await sl.oracle.listRequests('<ACCOUNT_ID>', { limit: 1 });
  const price = latest[0]?.Result || '0';

  // On-chain call (privnet). Replace with your contract script hash + method.
  const contract = '0x<contract-script-hash>';
  const account = new wallet.Account('<WIF>');
  const invokeResult = await rpcClient.invokeFunction(
    contract,
    'updatePrice',
    [sc.ContractParam.string(price)],
    [],
    { signers: [{ account: account.scriptHash, scopes: 1 }] }
  );
  console.log('tx status', invokeResult.state);
}

main().catch(console.error);
```

Notes:
- Use the privnet wallet WIF from your local node or `neo-go` wallet JSON. Ensure the contract is deployed on privnet and the caller has gas.
- Oracle results may need runner callbacks in production; for local dev with `dev-token` you can patch status via the HTTP API as shown earlier.
