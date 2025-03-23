import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const functionExecutionErrors = new Rate('function_execution_errors');
const functionExecutionTrend = new Trend('function_execution_duration');
const secretOperationErrors = new Rate('secret_operation_errors');
const secretOperationTrend = new Trend('secret_operation_duration');
const blockchainOperationErrors = new Rate('blockchain_operation_errors');
const blockchainOperationTrend = new Trend('blockchain_operation_duration');

// Options for the test
export const options = {
  // Test scenarios
  scenarios: {
    // Function execution load test
    function_execution: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 15 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'testFunctionExecution',
    },
    // Secret management load test
    secret_management: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'testSecretManagement',
    },
    // Blockchain operations load test
    blockchain_operations: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 8 },
        { duration: '30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'testBlockchainOperations',
    },
  },
  // Thresholds for metrics
  thresholds: {
    function_execution_errors: ['rate<0.1'], // Error rate less than 10%
    function_execution_duration: ['p(95)<2000'], // 95% of executions under 2s
    secret_operation_errors: ['rate<0.05'], // Error rate less than 5%
    secret_operation_duration: ['p(95)<1000'], // 95% of operations under 1s
    blockchain_operation_errors: ['rate<0.15'], // Error rate less than 15%
    blockchain_operation_duration: ['p(95)<3000'], // 95% of operations under 3s
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
  },
};

// Base URL for the API
const baseUrl = __ENV.API_URL || 'http://localhost:8080';
const apiKey = __ENV.API_KEY || 'test-api-key';

// Common headers
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiKey}`,
};

// Helper to generate a random user ID
function generateUserId() {
  return `user-${randomString(8)}`;
}

// Test function execution
export function testFunctionExecution() {
  const userId = generateUserId();
  
  // Create a test function
  const functionId = `test-function-${randomString(8)}`;
  const createPayload = JSON.stringify({
    id: functionId,
    code: `
      async function run(args) {
        // Simple computation
        let result = 0;
        for (let i = 0; i < args.iterations; i++) {
          result += i;
        }
        return { result: result };
      }
    `,
    owner: userId,
  });
  
  // Create function
  let response = http.post(`${baseUrl}/api/v1/functions`, createPayload, { headers });
  check(response, {
    'Function created': (r) => r.status === 201,
  });
  
  if (response.status !== 201) {
    functionExecutionErrors.add(1);
    return;
  }
  
  // Execute function
  const executePayload = JSON.stringify({
    iterations: 1000,
  });
  
  const startTime = new Date();
  response = http.post(`${baseUrl}/api/v1/functions/${functionId}/execute`, executePayload, { headers });
  const duration = new Date() - startTime;
  
  // Record metrics
  functionExecutionTrend.add(duration);
  
  // Check results
  const success = check(response, {
    'Function executed successfully': (r) => r.status === 200,
    'Function returned result': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    functionExecutionErrors.add(1);
  }
  
  // Delete function
  response = http.del(`${baseUrl}/api/v1/functions/${functionId}`, null, { headers });
  check(response, {
    'Function deleted': (r) => r.status === 204 || r.status === 200,
  });
  
  sleep(1);
}

// Test secret management
export function testSecretManagement() {
  const userId = generateUserId();
  
  // Create a secret
  const secretName = `test-secret-${randomString(8)}`;
  const secretValue = randomString(16);
  const createPayload = JSON.stringify({
    name: secretName,
    value: secretValue,
    owner: userId,
  });
  
  // Create secret
  const startTime = new Date();
  let response = http.post(`${baseUrl}/api/v1/secrets`, createPayload, { headers });
  const duration = new Date() - startTime;
  
  // Record metrics
  secretOperationTrend.add(duration);
  
  // Check results
  let success = check(response, {
    'Secret created': (r) => r.status === 201,
  });
  
  if (!success) {
    secretOperationErrors.add(1);
    return;
  }
  
  // Get secret
  response = http.get(`${baseUrl}/api/v1/secrets/${secretName}?owner=${userId}`, { headers });
  success = check(response, {
    'Secret retrieved': (r) => r.status === 200,
    'Secret value correct': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.value === secretValue;
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    secretOperationErrors.add(1);
  }
  
  // Delete secret
  response = http.del(`${baseUrl}/api/v1/secrets/${secretName}?owner=${userId}`, null, { headers });
  check(response, {
    'Secret deleted': (r) => r.status === 204 || r.status === 200,
  });
  
  sleep(1);
}

// Test blockchain operations
export function testBlockchainOperations() {
  // Get blockchain height
  const startTime = new Date();
  let response = http.get(`${baseUrl}/api/v1/blockchain/height`, { headers });
  const duration = new Date() - startTime;
  
  // Record metrics
  blockchainOperationTrend.add(duration);
  
  // Check results
  let success = check(response, {
    'Blockchain height retrieved': (r) => r.status === 200,
    'Blockchain height is a number': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !isNaN(parseInt(body.height));
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    blockchainOperationErrors.add(1);
    return;
  }
  
  // Invoke a read-only contract
  const invokePayload = JSON.stringify({
    scriptHash: '0x1234567890abcdef1234567890abcdef12345678',
    operation: 'balanceOf',
    params: [
      {
        type: 'Hash160',
        value: '0xabcdef1234567890abcdef1234567890abcdef12',
      },
    ],
  });
  
  response = http.post(`${baseUrl}/api/v1/blockchain/invoke`, invokePayload, { headers });
  success = check(response, {
    'Contract invoked': (r) => r.status === 200,
    'Contract returned result': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    blockchainOperationErrors.add(1);
  }
  
  sleep(1);
}