import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const apiTrend = new Trend('api_trend');
const errorRate = new Rate('error_rate');
const apiCalls = new Counter('api_calls');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users for 1 minute
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 50 },  // Stay at 50 users for 1 minute
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '1m', target: 100 },  // Stay at 100 users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should complete within 500ms
    http_req_failed: ['rate<0.05'],   // Less than 5% of requests should fail
    'api_trend{endpoint:health}': ['p(95)<100'], // Health endpoint should respond within 100ms
    'api_trend{endpoint:functions}': ['p(95)<300'], // Functions endpoint should respond within 300ms
    'api_trend{endpoint:price-feed}': ['p(95)<300'], // Price feed endpoint should respond within 300ms
    error_rate: ['rate<0.05'],        // Error rate should be less than 5%
  },
};

// Base URL and endpoints
const BASE_URL = __ENV.SERVICE_URL || 'http://localhost:8080';
const ENDPOINTS = {
  health: '/api/v1/health',
  functions: '/api/v1/functions',
  secrets: '/api/v1/secrets',
  priceFeed: '/api/v1/price-feed/latest',
  random: '/api/v1/random/info',
  oracle: '/api/v1/oracle/sources',
  gasBank: '/api/v1/gas-bank/balance',
};

// Auth parameters - would need to be updated for actual testing
const AUTH = {
  username: 'test@example.com',
  password: 'TestPassword123!',
};

// Reusable HTTP parameters with default headers
const params = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Main test function
export default function() {
  let authToken = null;
  
  // Login and get token if needed
  group('Authentication', function() {
    if (__ENV.AUTHENTICATED_TESTS === 'true') {
      const loginPayload = JSON.stringify({
        email: AUTH.username,
        password: AUTH.password,
      });
      
      const loginResponse = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, params);
      check(loginResponse, {
        'Login successful': (r) => r.status === 200,
        'Has auth token': (r) => r.json('token') !== null,
      });
      
      if (loginResponse.status === 200) {
        authToken = loginResponse.json('token');
        params.headers['Authorization'] = `Bearer ${authToken}`;
      }
    }
  });
  
  // Health check - public endpoint
  group('Health Check', function() {
    apiCalls.add(1, { endpoint: 'health' });
    const response = http.get(`${BASE_URL}${ENDPOINTS.health}`, params);
    apiTrend.add(response.timings.duration, { endpoint: 'health' });
    
    const success = check(response, {
      'Health check status is 200': (r) => r.status === 200,
      'Health check response is ok': (r) => r.json('status') === 'ok',
    });
    
    errorRate.add(!success, { endpoint: 'health' });
  });
  
  // Functions API - may require authentication
  group('Functions API', function() {
    apiCalls.add(1, { endpoint: 'functions' });
    const response = http.get(`${BASE_URL}${ENDPOINTS.functions}`, params);
    apiTrend.add(response.timings.duration, { endpoint: 'functions' });
    
    const success = check(response, {
      'Functions status is 200': (r) => r.status === 200,
      'Functions response has data': (r) => Array.isArray(r.json('data')),
    });
    
    errorRate.add(!success, { endpoint: 'functions' });
  });
  
  // Price Feed API - public data endpoint
  group('Price Feed API', function() {
    apiCalls.add(1, { endpoint: 'price-feed' });
    const response = http.get(`${BASE_URL}${ENDPOINTS.priceFeed}`, params);
    apiTrend.add(response.timings.duration, { endpoint: 'price-feed' });
    
    const success = check(response, {
      'Price Feed status is 200': (r) => r.status === 200,
      'Price Feed response has data': (r) => r.json('data') !== null,
    });
    
    errorRate.add(!success, { endpoint: 'price-feed' });
  });
  
  // Random Number API
  group('Random Number API', function() {
    apiCalls.add(1, { endpoint: 'random' });
    const response = http.get(`${BASE_URL}${ENDPOINTS.random}`, params);
    apiTrend.add(response.timings.duration, { endpoint: 'random' });
    
    const success = check(response, {
      'Random API status is 200': (r) => r.status === 200,
    });
    
    errorRate.add(!success, { endpoint: 'random' });
  });
  
  // Oracle API
  if (Math.random() < 0.5) { // Only call this endpoint 50% of the time to reduce load
    group('Oracle API', function() {
      apiCalls.add(1, { endpoint: 'oracle' });
      const response = http.get(`${BASE_URL}${ENDPOINTS.oracle}`, params);
      apiTrend.add(response.timings.duration, { endpoint: 'oracle' });
      
      const success = check(response, {
        'Oracle API status is 200': (r) => r.status === 200,
      });
      
      errorRate.add(!success, { endpoint: 'oracle' });
    });
  }
  
  // Gas Bank API - requires authentication
  if (__ENV.AUTHENTICATED_TESTS === 'true' && authToken) {
    group('Gas Bank API', function() {
      apiCalls.add(1, { endpoint: 'gas-bank' });
      const response = http.get(`${BASE_URL}${ENDPOINTS.gasBank}`, params);
      apiTrend.add(response.timings.duration, { endpoint: 'gas-bank' });
      
      const success = check(response, {
        'Gas Bank API status is 200': (r) => r.status === 200,
        'Gas Bank response has balance': (r) => r.json('balance') !== undefined,
      });
      
      errorRate.add(!success, { endpoint: 'gas-bank' });
    });
  }
  
  // Add a random sleep between requests to simulate real user behavior
  sleep(randomIntBetween(1, 3));
}