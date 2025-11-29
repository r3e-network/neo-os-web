/**
 * Minimal tests for the Service Layer TypeScript client.
 * Uses a tiny harness and a mocked fetch implementation.
 */

import { ServiceLayerClient, ServiceLayerError } from './index';

type FetchHandler = (input: string, init?: RequestInit) => Promise<Response>;

type TestCase = { name: string; fn: () => void | Promise<void> };

const tests: TestCase[] = [];
const results: { name: string; passed: boolean; error?: string }[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

function createMockFetch(expectations: Record<string, any>): FetchHandler {
  return async (url: string, init?: RequestInit) => {
    const key = `${init?.method || 'GET'} ${new URL(url).pathname}`;
    const responseBody = expectations[key] ?? {};
    const status = expectations[`${key}:status`] ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      text: async () => JSON.stringify(responseBody),
    } as Response;
  };
}

test('client wires all services', () => {
  const client = new ServiceLayerClient({ baseURL: 'http://localhost' });
  const services = ['accounts', 'functions', 'gasBank', 'oracle', 'dataFeeds', 'dataStreams', 'dataLink', 'bus', 'system'];
  for (const svc of services) {
    assert((client as any)[svc], `${svc} should be defined`);
  }
});

test('auth and tenant headers are sent', async () => {
  let gotAuth = '';
  let gotTenant = '';
  const fetch: FetchHandler = async (url: string, init?: RequestInit) => {
    gotAuth = (init?.headers as any)?.['Authorization'] || '';
    gotTenant = (init?.headers as any)?.['X-Tenant-ID'] || '';
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify([]),
    } as Response;
  };
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 'tok', tenantID: 'tenant-1' });
  await client.accounts.list();
  assert(gotAuth === 'Bearer tok', 'expected bearer token header');
  assert(gotTenant === 'tenant-1', 'expected tenant header');
});

test('accounts.create hits /accounts', async () => {
  const fetch = createMockFetch({ 'POST /accounts': { ID: 'acc-1', Owner: 'alice' } });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test' });
  const acc = await client.accounts.create('alice', { t: 'tenant' });
  assert(acc.ID === 'acc-1', 'account id should match');
});

test('functions.execute uses correct path', async () => {
  const fetch = createMockFetch({
    'POST /accounts/acc-1/functions/fn-1/execute': { ID: 'exec-1', FunctionID: 'fn-1', AccountID: 'acc-1', Status: 'ok' },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test' });
  const exec = await client.functions.execute('acc-1', 'fn-1', { msg: 'hi' });
  assert(exec.ID === 'exec-1', 'execution id should match');
});

test('gasBank.deposit uses gasbank/deposit', async () => {
  const fetch = createMockFetch({
    'POST /accounts/acc-1/gasbank/deposit': { account: { ID: 'gas-1' }, transaction: { ID: 'tx-1' } },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test' });
  const res = await client.gasBank.deposit('acc-1', { gas_account_id: 'gas-1', amount: 1, tx_id: 'hash' });
  assert(res.transaction.ID === 'tx-1', 'transaction id should match');
});

test('dataFeeds.latest uses /latest endpoint', async () => {
  const fetch = createMockFetch({
    'GET /accounts/acc-1/datafeeds/feed-1/latest': { ID: 'upd-1', FeedID: 'feed-1' },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test' });
  const latest = await client.dataFeeds.latest('acc-1', 'feed-1');
  assert(latest.ID === 'upd-1', 'latest update id should match');
});

test('refresh token is used on 401', async () => {
  const calls: string[] = [];
  const fetch: FetchHandler = async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method || 'GET'} ${new URL(url).pathname} ${init?.headers ? (init.headers as any)['Authorization'] : ''}`.trim());
    if (url.includes('/auth/refresh')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ access_token: 'new-token' }),
      } as Response;
    }
    if (!url.includes('/auth/refresh') && (!init?.headers || !(init.headers as any)['Authorization'])) {
      return { ok: false, status: 401, statusText: 'Unauthorized', text: async () => '' } as Response;
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ ok: true }),
    } as Response;
  };
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', refreshToken: 'rt-123' });
  const res = await client.accounts.list();
  assert((res as any).ok === true, 'expected success after refresh');
  assert(calls.some((c) => c.includes('/auth/refresh')), 'refresh endpoint should be called');
  assert(calls.some((c) => c.includes('Bearer new-token')), 'retried with new token');
});

test('bus endpoints call /system routes', async () => {
  const fetch = createMockFetch({
    'POST /system/events': { status: 'ok' },
    'POST /system/data': { status: 'ok' },
    'POST /system/compute': { results: [{ Module: 'mock', Result: { ok: true } }] },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const ev = await client.bus.publishEvent('pricefeed.updated', { id: '1' });
  assert(ev.status === 'ok', 'event response should be ok');
  const data = await client.bus.pushData('pricefeed.updated', { id: '1' });
  assert(data.status === 'ok', 'data response should be ok');
  const compute = await client.bus.compute({ action: 'refresh' });
  assert(Array.isArray(compute.results), 'compute should return results');
});

test('non-2xx responses raise ServiceLayerError with parsed body', async () => {
  const fetch = createMockFetch({
    'GET /accounts': { error: 'bad' },
    'GET /accounts:status': 400,
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  let caught: ServiceLayerError | null = null;
  try {
    await client.accounts.list();
  } catch (err: any) {
    caught = err;
  }
  assert(caught instanceof ServiceLayerError, 'expected ServiceLayerError');
  assert(caught?.statusCode === 400, 'status code should be 400');
  assert((caught?.response as any)?.error === 'bad', 'response body should be parsed');
});

test('plain-text responses are returned as strings', async () => {
  const fetch: FetchHandler = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => 'plain-text',
  } as Response);
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const res: any = await client.system.health();
  assert(res === 'plain-text', 'expected raw text when JSON parse fails');
});

test('baseURL is normalised and query params are encoded', async () => {
  let calledURL = '';
  const fetch: FetchHandler = async (url: string, init?: RequestInit) => {
    calledURL = url;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '[]',
    } as Response;
  };
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test/', token: 't' });
  await client.gasBank.listTransactions('acc-1', { gas_account_id: 'gas-1', status: 'pending', limit: 5 });
  assert(
    calledURL === 'http://api.test/accounts/acc-1/gasbank/transactions?gas_account_id=gas-1&status=pending&limit=5',
    `unexpected url: ${calledURL}`
  );
});

test('random.generate posts to /random', async () => {
  const fetch = createMockFetch({
    'POST /accounts/acc-1/random': { ID: 'rand-1', Status: 'ok' },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const res = await client.random.generate('acc-1', { length: 16, request_id: 'req-1' });
  assert(res.ID === 'rand-1', 'expected random request id');
});

test('priceFeeds.update uses PATCH', async () => {
  const fetch = createMockFetch({
    'PATCH /accounts/acc-1/pricefeeds/feed-1': { ID: 'feed-1', DeviationPercent: 1.5 },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const feed = await client.priceFeeds.update('acc-1', 'feed-1', { deviation_percent: 1.5 });
  assert(feed.ID === 'feed-1', 'expected feed id');
});

test('vrf.createRequest posts to key-specific path', async () => {
  const fetch = createMockFetch({
    'POST /accounts/acc-1/vrf/keys/key-1/requests': { ID: 'vrf-req', KeyID: 'key-1' },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const req = await client.vrf.createRequest('acc-1', 'key-1', { consumer: 'c1', seed: 'seed' });
  assert(req.ID === 'vrf-req', 'expected vrf request id');
});

test('accounts.delete uses DELETE', async () => {
  const fetch = createMockFetch({
    'DELETE /accounts/acc-1': {},
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  await client.accounts.delete('acc-1');
});

test('secrets CRUD paths are wired', async () => {
  const fetch = createMockFetch({
    'POST /accounts/acc-1/secrets': { ID: 'sec-1', Name: 'apiKey', ACL: 1, Version: 1 },
    'GET /accounts/acc-1/secrets/apiKey': { ID: 'sec-1', Name: 'apiKey', Value: 'v1', ACL: 1, Version: 1 },
    'PUT /accounts/acc-1/secrets/apiKey': { ID: 'sec-1', Name: 'apiKey', ACL: 3, Version: 2 },
    'DELETE /accounts/acc-1/secrets/apiKey': {},
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const created = await client.secrets.create('acc-1', { name: 'apiKey', value: 'v1', acl: 1 });
  assert(created.Version === 1 && created.ACL === 1, 'created secret fields');
  const fetched = await client.secrets.get('acc-1', 'apiKey');
  assert(fetched.Value === 'v1', 'fetched secret value');
  const updated = await client.secrets.update('acc-1', 'apiKey', { acl: 3 });
  assert(updated.Version === 2 && updated.ACL === 3, 'updated secret ACL/version');
  await client.secrets.delete('acc-1', 'apiKey');
});

test('dataFeeds.submitUpdate posts to updates path', async () => {
  const fetch = createMockFetch({
    'POST /accounts/acc-1/datafeeds/feed-1/updates': { ID: 'upd-1', FeedID: 'feed-1' },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const upd = await client.dataFeeds.submitUpdate('acc-1', 'feed-1', {
    round_id: 1,
    price: '123',
    signer: 's1',
    timestamp: 'now',
  });
  assert(upd.ID === 'upd-1', 'expected update id');
});

test('dataLink.createDelivery posts to channel deliveries', async () => {
  const fetch = createMockFetch({
    'POST /accounts/acc-1/datalink/channels/ch-1/deliveries': { ID: 'del-1' },
  });
  // @ts-expect-error override global fetch for tests
  global.fetch = fetch;
  const client = new ServiceLayerClient({ baseURL: 'http://api.test', token: 't' });
  const del = await client.dataLink.createDelivery('acc-1', 'ch-1', { payload: { msg: 'hi' } });
  assert(del.ID === 'del-1', 'expected delivery id');
});

async function run() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  }

  let failed = 0;
  for (const result of results) {
    if (result.passed) {
      console.log(`✓ ${result.name}`);
    } else {
      failed++;
      console.log(`✗ ${result.name}`);
      console.log(`  ${result.error}`);
    }
  }
  if (failed > 0) {
    throw new Error(`${failed} test(s) failed`);
  }
}

run();
