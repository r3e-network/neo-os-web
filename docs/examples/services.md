# Service Layer API Examples

Pragmatic, copy-pasteable examples for each major service. Replace `<TOKEN>` with a valid bearer and `<ACCOUNT_ID>` with your account ID.

All commands assume the appserver is running at `http://localhost:8080` and that you set `export TOKEN=<TOKEN>`.

## Accounts
```bash
curl -s -X POST http://localhost:8080/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"owner":"alice"}'

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/accounts
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

# runner marks running/succeeded (requires X-Oracle-Runner-Token if configured)
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

# paginate + filter
curl -i -H "Authorization: Bearer $TOKEN" "http://localhost:8080/accounts/<ACCOUNT_ID>/oracle/requests?status=failed&limit=1"
```

## Datafeeds
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/datafeeds \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"pair":"NEO/USD","threshold_ppm":5000,"signer_set":["'"$TEST_WALLET"'"]}'
```

## Pricefeeds
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/pricefeeds \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"pair":"NEO/USD","deviation_percent":1.5,"heartbeat":60000000000}'
```

## Gasbank
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/gasbank/deposit \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":5.0,"tx_id":"tx123"}'

curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/gasbank/withdraw \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"amount":1.0,"to_address":"ADDR"}'
```

## Randomness
```bash
curl -s -X POST http://localhost:8080/accounts/<ACCOUNT_ID>/random \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"length":32,"request_id":"example"}'
```

## CLI equivalents (slctl)
```bash
slctl accounts list --token "$TOKEN"
slctl oracle requests list --account <ACCOUNT_ID> --token "$TOKEN" --status failed --limit 5
slctl oracle requests retry --account <ACCOUNT_ID> --token "$TOKEN" --id "$REQ_ID"
slctl gasbank deposit --account <ACCOUNT_ID> --token "$TOKEN" --amount 5
slctl random generate --account <ACCOUNT_ID> --token "$TOKEN" --length 16
```
