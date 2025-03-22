import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';
import { URLSearchParams } from 'https://jslib.k6.io/url/1.0.0/index.js';
import exec from 'k6/execution';

// Custom metrics
const functionCallSuccessRate = new Rate('function_call_success');
const transactionSuccessRate = new Rate('transaction_success');
const oracleFetchSuccessRate = new Rate('oracle_fetch_success');
const priceFeedSuccessRate = new Rate('price_feed_success');
const randomNumberSuccessRate = new Rate('random_number_success');
const systemResponseTime = new Trend('system_response_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_USERNAME = __ENV.AUTH_USERNAME || 'performance_test_user';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'performance_test_password';
const VU_COUNT = __ENV.VU_COUNT || 50;

// Full system load test scenario
export const options = {
  scenarios: {
    full_system_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: Math.ceil(VU_COUNT * 0.2) }, // Ramp up to 20% of max VUs
        { duration: '3m', target: Math.ceil(VU_COUNT * 0.5) }, // Ramp up to 50% of max VUs
        { duration: '5m', target: VU_COUNT },                  // Ramp up to 100% of max VUs
        { duration: '10m', target: VU_COUNT },                 // Stay at max VUs for 10 minutes
        { duration: '5m', target: Math.ceil(VU_COUNT * 0.5) }, // Ramp down to 50% of max VUs
        { duration: '2m', target: 0 },                         // Ramp down to 0 VUs
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1s
    'http_req_duration{group:::auth}': ['p(95)<500'], // Authentication should be fast
    'http_req_duration{group:::functions}': ['p(95)<2000'], // Function execution allowed to be slower
    'http_req_duration{group:::transactions}': ['p(95)<1000'],
    'http_req_duration{group:::price_feeds}': ['p(95)<500'],
    'http_req_duration{group:::random_numbers}': ['p(95)<1000'],
    'http_req_duration{group:::oracles}': ['p(95)<1000'],
    'http_req_duration{group:::secrets}': ['p(95)<500'],
    function_call_success: ['rate>0.95'], // 95% success rate for function calls
    transaction_success: ['rate>0.95'],    // 95% success rate for transactions
    oracle_fetch_success: ['rate>0.95'],   // 95% success rate for oracle fetches
    price_feed_success: ['rate>0.95'],     // 95% success rate for price feeds
    random_number_success: ['rate>0.95'],  // 95% success rate for random number requests
    system_response_time: ['p(95)<1500'],  // Overall system response time
  },
};

// Setup function - authenticate and get token
export function setup() {
  console.log(`Starting full system performance test with ${VU_COUNT} VUs`);
  console.log(`Target API: ${BASE_URL}`);
  
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    username_or_email: AUTH_USERNAME,
    password: AUTH_PASSWORD
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { group: 'auth' }
  });
  
  check(loginRes, {
    'login successful': (res) => res.status === 200 && res.json('success') === true,
  });
  
  if (loginRes.status !== 200) {
    console.error(`Login failed: ${loginRes.body}`);
    return { token: null };
  }
  
  const token = loginRes.json('data').access_token;
  console.log('Authentication successful');
  
  // Create some test data for testing
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  
  // Create a test function
  const functionId = `test-function-${randomString(8)}`;
  const functionRes = http.post(`${BASE_URL}/api/v1/functions`, JSON.stringify({
    id: functionId,
    name: "Test Function",
    description: "Function for performance testing",
    source_code: `
      function main(params) {
        // Simple calculation
        let result = 0;
        for (let i = 0; i < 1000; i++) {
          result += i;
        }
        return { result: result, params: params };
      }
    `
  }), { headers, tags: { group: 'setup' } });
  
  check(functionRes, {
    'function created': (res) => res.status === 200 && res.json('success') === true,
  });
  
  // Create a test secret
  const secretId = `test-secret-${randomString(8)}`;
  const secretRes = http.post(`${BASE_URL}/api/v1/secrets`, JSON.stringify({
    id: secretId,
    name: "Test Secret",
    value: "secret-value-for-testing"
  }), { headers, tags: { group: 'setup' } });
  
  check(secretRes, {
    'secret created': (res) => res.status === 200 && res.json('success') === true,
  });
  
  // Create a test trigger
  const triggerId = `test-trigger-${randomString(8)}`;
  const triggerRes = http.post(`${BASE_URL}/api/v1/triggers`, JSON.stringify({
    id: triggerId,
    name: "Test Trigger",
    type: "cron",
    config: {
      cron: "*/5 * * * *"  // Every 5 minutes
    },
    function_id: functionId,
    parameters: {
      test: true
    }
  }), { headers, tags: { group: 'setup' } });
  
  check(triggerRes, {
    'trigger created': (res) => res.status === 200 && res.json('success') === true,
  });
  
  return { 
    token: token,
    function_id: functionId,
    secret_id: secretId,
    trigger_id: triggerId
  };
}

// Main test function
export default function(data) {
  if (!data.token) {
    console.error('No authentication token available, skipping test');
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };
  
  // Sleep between 1-3 seconds to simulate real user behavior
  sleep(1 + Math.random() * 2);
  
  // Weighted random selection of operation type
  const operations = [
    { weight: 20, op: () => testFunctions(headers, data) },       // 20% - Functions operations
    { weight: 15, op: () => testTransactions(headers, data) },    // 15% - Transaction operations
    { weight: 15, op: () => testPriceFeeds(headers, data) },      // 15% - Price feed operations
    { weight: 10, op: () => testRandomNumbers(headers, data) },   // 10% - Random number operations
    { weight: 15, op: () => testOracleService(headers, data) },   // 15% - Oracle operations
    { weight: 10, op: () => testSecrets(headers, data) },         // 10% - Secrets operations
    { weight: 10, op: () => testTriggers(headers, data) },        // 10% - Automation operations
    { weight: 5, op: () => testDashboard(headers, data) }         // 5% - Dashboard operations
  ];
  
  // Calculate total weight
  const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
  
  // Pick a random operation based on weight
  let random = Math.random() * totalWeight;
  let selectedOp = operations[operations.length - 1].op;
  
  for (const op of operations) {
    if (random < op.weight) {
      selectedOp = op.op;
      break;
    }
    random -= op.weight;
  }
  
  // Execute the selected operation
  selectedOp();
}

// Test Functions Service
function testFunctions(headers, data) {
  group('functions', function() {
    // Get a list of functions
    const listRes = http.get(`${BASE_URL}/api/v1/functions?limit=10`, { 
      headers, 
      tags: { group: 'functions' }
    });
    
    check(listRes, {
      'list functions successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    // Execute the test function
    const startTime = new Date();
    const execRes = http.post(`${BASE_URL}/api/v1/functions/${data.function_id}/execute`, JSON.stringify({
      parameters: {
        value: randomString(8),
        timestamp: new Date().toISOString()
      }
    }), {
      headers,
      tags: { group: 'functions' }
    });
    const endTime = new Date();
    
    const execSuccess = check(execRes, {
      'function execution successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    functionCallSuccessRate.add(execSuccess);
    systemResponseTime.add(endTime - startTime);
    
    // Get function execution history
    http.get(`${BASE_URL}/api/v1/functions/${data.function_id}/executions?limit=5`, { 
      headers, 
      tags: { group: 'functions' }
    });
  });
}

// Test Transaction Management
function testTransactions(headers, data) {
  group('transactions', function() {
    // Create a test transaction
    const txCreateRes = http.post(`${BASE_URL}/api/v1/transactions`, JSON.stringify({
      type: 'test',
      target_contract: 'performance-test',
      parameters: {
        method: 'test',
        args: [randomString(8), new Date().toISOString()]
      }
    }), {
      headers,
      tags: { group: 'transactions' }
    });
    
    const txSuccess = check(txCreateRes, {
      'transaction created successfully': (res) => res.status === 200 && res.json('success') === true,
    });
    
    transactionSuccessRate.add(txSuccess);
    
    if (txSuccess) {
      const txId = txCreateRes.json('data').id;
      
      // Get transaction details
      http.get(`${BASE_URL}/api/v1/transactions/${txId}`, { 
        headers, 
        tags: { group: 'transactions' }
      });
      
      // List recent transactions
      http.get(`${BASE_URL}/api/v1/transactions?limit=10&status=all`, { 
        headers, 
        tags: { group: 'transactions' }
      });
    }
  });
}

// Test Price Feed Service
function testPriceFeeds(headers, data) {
  group('price_feeds', function() {
    // Get list of price feeds
    const listRes = http.get(`${BASE_URL}/api/v1/price-feeds`, { 
      headers, 
      tags: { group: 'price_feeds' }
    });
    
    const feedSuccess = check(listRes, {
      'list price feeds successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    priceFeedSuccessRate.add(feedSuccess);
    
    // Get current prices
    const pricesRes = http.get(`${BASE_URL}/api/v1/price-feeds/current?symbols=NEO,GAS,BTC,ETH`, { 
      headers, 
      tags: { group: 'price_feeds' }
    });
    
    check(pricesRes, {
      'get current prices successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    // Get price history for a symbol
    http.get(`${BASE_URL}/api/v1/price-feeds/history?symbol=NEO&from=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`, { 
      headers, 
      tags: { group: 'price_feeds' }
    });
  });
}

// Test Random Number Service
function testRandomNumbers(headers, data) {
  group('random_numbers', function() {
    // Create a random number request
    const requestRes = http.post(`${BASE_URL}/api/v1/random-numbers/request`, JSON.stringify({
      callback_contract: 'test-contract',
      callback_method: 'onRandomNumber',
      user_seed: randomString(16)
    }), {
      headers,
      tags: { group: 'random_numbers' }
    });
    
    const randomSuccess = check(requestRes, {
      'random number request successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    randomNumberSuccessRate.add(randomSuccess);
    
    if (randomSuccess) {
      const requestId = requestRes.json('data').id;
      
      // Get request status
      http.get(`${BASE_URL}/api/v1/random-numbers/request/${requestId}`, { 
        headers, 
        tags: { group: 'random_numbers' }
      });
    }
    
    // List random number requests
    http.get(`${BASE_URL}/api/v1/random-numbers/requests?limit=10`, { 
      headers, 
      tags: { group: 'random_numbers' }
    });
  });
}

// Test Oracle Service
function testOracleService(headers, data) {
  group('oracles', function() {
    // Get list of oracle data sources
    const sourcesRes = http.get(`${BASE_URL}/api/v1/oracles/sources?limit=10`, { 
      headers, 
      tags: { group: 'oracles' }
    });
    
    check(sourcesRes, {
      'list oracle sources successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    // Create an oracle request
    const requestRes = http.post(`${BASE_URL}/api/v1/oracles/request`, JSON.stringify({
      source_type: 'http',
      url: 'https://api.example.com/data',
      method: 'GET',
      callback_contract: 'test-contract',
      callback_method: 'onOracleData',
      path: '$.data.value'
    }), {
      headers,
      tags: { group: 'oracles' }
    });
    
    const oracleSuccess = check(requestRes, {
      'oracle request successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    oracleFetchSuccessRate.add(oracleSuccess);
    
    // List oracle requests
    http.get(`${BASE_URL}/api/v1/oracles/requests?limit=10`, { 
      headers, 
      tags: { group: 'oracles' }
    });
  });
}

// Test Secrets Service
function testSecrets(headers, data) {
  group('secrets', function() {
    // List secrets
    const listRes = http.get(`${BASE_URL}/api/v1/secrets?limit=10`, { 
      headers, 
      tags: { group: 'secrets' }
    });
    
    check(listRes, {
      'list secrets successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    // Get specific secret (only metadata, not value)
    http.get(`${BASE_URL}/api/v1/secrets/${data.secret_id}`, { 
      headers, 
      tags: { group: 'secrets' }
    });
    
    // Create a new secret (occasionally)
    if (Math.random() < 0.1) { // 10% chance
      http.post(`${BASE_URL}/api/v1/secrets`, JSON.stringify({
        id: `perf-secret-${randomString(8)}`,
        name: `Performance Test Secret ${exec.vu.idInTest}`,
        value: randomString(32)
      }), {
        headers,
        tags: { group: 'secrets' }
      });
    }
  });
}

// Test Automation/Triggers Service
function testTriggers(headers, data) {
  group('triggers', function() {
    // List triggers
    const listRes = http.get(`${BASE_URL}/api/v1/triggers?limit=10`, { 
      headers, 
      tags: { group: 'triggers' }
    });
    
    check(listRes, {
      'list triggers successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    // Get specific trigger
    http.get(`${BASE_URL}/api/v1/triggers/${data.trigger_id}`, { 
      headers, 
      tags: { group: 'triggers' }
    });
    
    // Get trigger execution history
    http.get(`${BASE_URL}/api/v1/triggers/${data.trigger_id}/history?limit=5`, { 
      headers, 
      tags: { group: 'triggers' }
    });
  });
}

// Test Dashboard
function testDashboard(headers, data) {
  group('dashboard', function() {
    // Get dashboard metrics
    const metricsRes = http.get(`${BASE_URL}/api/v1/dashboard/metrics`, { 
      headers, 
      tags: { group: 'dashboard' }
    });
    
    check(metricsRes, {
      'get dashboard metrics successful': (res) => res.status === 200 && res.json('success') === true,
    });
    
    // Get service health status
    http.get(`${BASE_URL}/api/v1/dashboard/health`, { 
      headers, 
      tags: { group: 'dashboard' }
    });
    
    // Get recent activity
    http.get(`${BASE_URL}/api/v1/dashboard/activity?limit=10`, { 
      headers, 
      tags: { group: 'dashboard' }
    });
  });
}

// Teardown function - cleanup test data
export function teardown(data) {
  if (!data.token) {
    console.log('No token available, skipping teardown');
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };
  
  // Delete test triggers
  if (data.trigger_id) {
    http.del(`${BASE_URL}/api/v1/triggers/${data.trigger_id}`, null, { 
      headers, 
      tags: { group: 'teardown' }
    });
  }
  
  // Delete test functions
  if (data.function_id) {
    http.del(`${BASE_URL}/api/v1/functions/${data.function_id}`, null, { 
      headers, 
      tags: { group: 'teardown' }
    });
  }
  
  // Delete test secrets
  if (data.secret_id) {
    http.del(`${BASE_URL}/api/v1/secrets/${data.secret_id}`, null, { 
      headers, 
      tags: { group: 'teardown' }
    });
  }
  
  console.log('Test data cleanup completed');
}