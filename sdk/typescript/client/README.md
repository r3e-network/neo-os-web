# Service Layer TypeScript Client

Typed SDK for the Service Layer API.

## Install

```bash
npm install @service-layer/client
```

## Usage

```ts
import { ServiceLayerClient } from '@service-layer/client';

const client = new ServiceLayerClient({
  baseURL: 'http://localhost:8080',
  token: 'dev-token',
});

const accounts = await client.accounts.list();
```

## Supabase refresh tokens

Pass a `refreshToken` in `ClientConfig` to allow the SDK to fetch an access token from `/auth/refresh` and retry once on 401:

```ts
import { ServiceLayerClient } from '@service-layer/client';

const client = new ServiceLayerClient({
  baseURL: 'http://localhost:8080',
  refreshToken: process.env.SUPABASE_REFRESH_TOKEN,
  tenantID: process.env.SERVICE_LAYER_TENANT, // optional: sets X-Tenant-ID
});

const accounts = await client.accounts.list();
```

## Example: fetch price feeds

```ts
import { ServiceLayerClient } from '@service-layer/client';

async function main() {
  const client = new ServiceLayerClient({
    baseURL: process.env.SERVICE_LAYER_API ?? 'http://localhost:8080',
    token: process.env.SERVICE_LAYER_TOKEN,
    refreshToken: process.env.SUPABASE_REFRESH_TOKEN,
    tenantID: process.env.SERVICE_LAYER_TENANT,
  });
  const feeds = await client.priceFeeds.list();
  console.log('feeds', feeds);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Engine bus

Publish events/data to every registered module or invoke compute fan-out:

```ts
await client.bus.publishEvent('pricefeed.updated', { id: 'feed-1' });
await client.bus.pushData('pricefeed.updated', { id: 'feed-1' });
const { results } = await client.bus.compute({ action: 'ping' });
console.log(results);
```
```
