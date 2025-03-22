# Neo N3 Service Layer Developer Guide

This guide provides instructions for developers who want to use the Neo N3 Service Layer API to enhance their smart contracts with external data and automation.

## Getting Started

### 1. Create an Account

To start using the Neo N3 Service Layer, you need to create an account:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "email": "your_email@example.com",
    "password": "your_password"
  }'
```

### 2. Get Authentication Token

Once you have an account, you need to obtain an authentication token:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username_or_email": "your_username",
    "password": "your_password"
  }'
```

The response will include:

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "expires_in": 86400
  }
}
```

Use the `access_token` in all subsequent API requests.

## Using JavaScript Functions

### Creating a Function

Create a JavaScript function that will be executed in the TEE:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/functions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "calculateAverage",
    "description": "Calculate average of token prices",
    "source_code": "function calculate(sources) { \n  let sum = 0; \n  for (const source of sources) { \n    sum += source.price; \n  } \n  return { average: sum / sources.length }; \n}",
    "timeout": 5,
    "memory": 128,
    "secrets": ["api_key1", "api_key2"]
  }'
```

### Executing a Function

Execute a function:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/functions/123/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "params": {
      "sources": [
        {"name": "source1", "price": 42},
        {"name": "source2", "price": 43}
      ]
    },
    "async": false
  }'
```

## Managing Secrets

### Storing a Secret

Store a secret that can be used by your functions:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/secrets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "api_key1",
    "value": "your_secret_api_key"
  }'
```

### Getting Secret Metadata

Get metadata about your secret (the actual value is never returned):

```bash
curl -X GET https://api.servicelayer.neo.org/v1/secrets/api_key1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Setting Up Contract Automation

### Creating a Trigger

Create a trigger to automate contract functions:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/triggers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Daily Price Update",
    "description": "Updates token prices every day at midnight",
    "trigger_type": "cron",
    "trigger_config": {
      "schedule": "0 0 * * *",
      "timezone": "UTC"
    },
    "function_id": 123
  }'
```

The Service Layer supports several types of triggers:

1. **Cron triggers** - Time-based using cron syntax
   ```json
   {
     "trigger_type": "cron",
     "trigger_config": {
       "schedule": "0 0 * * *",
       "timezone": "UTC"
     }
   }
   ```

2. **Price triggers** - Based on token price changes
   ```json
   {
     "trigger_type": "price",
     "trigger_config": {
       "asset_pair": "NEO/USD",
       "condition": "above",
       "threshold": 50.0,
       "duration": 300
     }
   }
   ```

3. **Blockchain triggers** - Based on blockchain events
   ```json
   {
     "trigger_type": "blockchain",
     "trigger_config": {
       "contract_hash": "0x1234567890abcdef",
       "event_name": "Transfer"
     }
   }
   ```

## Using the Price Feed

### Creating a Price Feed

Set up a price feed for a token pair:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/pricefeeds \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "asset_pair": "NEO/USD",
    "frequency": 300,
    "sources": [
      "binance",
      "huobi",
      "gate"
    ],
    "aggregation": "median",
    "deviation": 0.5
  }'
```

### Getting Latest Price

Get the latest price for a token:

```bash
curl -X GET https://api.servicelayer.neo.org/v1/pricefeeds/123 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Random Number Generation

### Generating a Random Number

Generate a verifiably random number:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/random \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "min": 1,
    "max": 100
  }'
```

### Verifying a Random Number

Verify a previously generated random number:

```bash
curl -X GET https://api.servicelayer.neo.org/v1/random/123/verify \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Gas Bank

### Depositing Gas

Deposit gas to be used by the service:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/gasbank/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "amount": 10.0,
    "tx_hash": "0x1234567890abcdef1234567890abcdef12345678"
  }'
```

### Checking Gas Balance

Check your gas balance:

```bash
curl -X GET https://api.servicelayer.neo.org/v1/gasbank/balance \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Smart Contract Integration

### 1. Deploy the Smart Contract

Deploy the smart contract to the Neo N3 blockchain using Neo Blockchain Toolkit.

### 2. Register the Contract with Service Layer

Register your contract's hash with the Service Layer to enable automation:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/contracts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "OracleConsumer",
    "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
    "description": "Oracle consumer contract"
  }'
```

### 3. Set Up Automation Triggers

Create triggers to automate your contract functions:

```bash
curl -X POST https://api.servicelayer.neo.org/v1/triggers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Daily Price Update",
    "description": "Updates token prices every day at midnight",
    "trigger_type": "cron",
    "trigger_config": {
      "schedule": "0 0 * * *",
      "timezone": "UTC"
    },
    "contract_id": 123,
    "method": "executeAutomation",
    "parameters": [
      {
        "type": "String",
        "value": "updatePrices"
      }
    ]
  }'
```

## Best Practices

### Security

1. Never hardcode sensitive data like API keys in your functions.
2. Use the Secrets management feature to securely store sensitive information.
3. Implement proper authentication in your smart contracts.
4. Use rate limiting to prevent excessive API calls.

### Performance

1. Keep JavaScript functions small and focused on a single task.
2. Limit the number of external API calls in your functions.
3. Set reasonable timeouts for your functions.
4. Use caching where appropriate to reduce redundant calls.

### Reliability

1. Implement error handling in your functions and smart contracts.
2. Test your functions thoroughly before deploying to production.
3. Monitor function execution logs for errors.
4. Set up alerts for failed automations.

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Make sure your access token is valid and not expired
   - If expired, use the refresh token to get a new access token

2. **Function Execution Errors**
   - Check the function logs for detailed error messages
   - Verify that all required secrets are available
   - Ensure your function code is syntactically correct

3. **Trigger Execution Failures**
   - Check that the contract hash is correct
   - Verify that the method exists in your contract
   - Ensure parameters are correctly formatted

### Getting Help

For additional support:

- Check the [API documentation](https://api.servicelayer.neo.org/docs)
- Join the Neo N3 Service Layer community forum
- Contact support at support@servicelayer.neo.org