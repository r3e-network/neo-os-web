"use client";

import Link from 'next/link';

export default function ApiDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Neo Service Layer API Reference</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          This documentation provides a comprehensive reference for the Neo Service Layer API.
          You&apos;ll find detailed information about each endpoint, including parameters, 
          response formats, and example requests.
        </p>
      </div>
      
      <h2>API Basics</h2>
      
      <div className="my-8">
        <h3>Base URL</h3>
        <p>
          All API endpoints use the following base URL:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">https://api.neo-service-layer.io/v1</pre>
        
        <h3>Authentication</h3>
        <p>
          All API requests require authentication using an API key. Include your API key in the 
          <code>X-API-Key</code> header with each request:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`curl -X GET "https://api.neo-service-layer.io/v1/functions" \\
  -H "X-API-Key: your-api-key-here"`}</pre>
        
        <p>
          For detailed information about API authentication, see the <Link href="/docs/api/authentication" className="text-primary hover:underline">Authentication documentation</Link>.
        </p>
        
        <h3>Response Format</h3>
        <p>
          All API responses are returned in JSON format. A typical successful response has the following structure:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": {
    // Response data specific to the endpoint
  }
}`}</pre>

        <p>
          Error responses include error information:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": false,
  "error": {
    "code": "error_code",
    "message": "Detailed error message"
  }
}`}</pre>
        
        <h3>Rate Limiting</h3>
        <p>
          API requests are subject to rate limiting based on your plan tier. The current limits are 
          included in the response headers:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`X-Rate-Limit-Limit: 100       // Number of requests allowed in the period
X-Rate-Limit-Remaining: 95    // Number of remaining requests in the current period
X-Rate-Limit-Reset: 1625097600 // Unix timestamp when the limit resets`}</pre>
      </div>
      
      <h2>API Services</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        <Link
          href="/docs/api/functions-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Functions API</h3>
          <p className="text-gray-600 mb-2">
            Create, deploy, manage, and invoke serverless functions in a secure TEE.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
        
        <Link
          href="/docs/api/secrets-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Secrets API</h3>
          <p className="text-gray-600 mb-2">
            Securely store and manage sensitive data and credentials.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
        
        <Link
          href="/docs/api/automation-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Automation API</h3>
          <p className="text-gray-600 mb-2">
            Create and manage contract automation based on time, events, or conditions.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
        
        <Link
          href="/docs/api/gas-bank-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Gas Bank API</h3>
          <p className="text-gray-600 mb-2">
            Manage GAS deposits, withdrawals, and service operation funding.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
        
        <Link
          href="/docs/api/price-feed-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Price Feed API</h3>
          <p className="text-gray-600 mb-2">
            Configure and consume reliable token price data.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
        
        <Link
          href="/docs/api/random-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Random Number API</h3>
          <p className="text-gray-600 mb-2">
            Generate and verify secure random numbers.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
        
        <Link
          href="/docs/api/oracle-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Oracle API</h3>
          <p className="text-gray-600 mb-2">
            Create data feeds and connect smart contracts with external data sources.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
        
        <Link
          href="/docs/api/admin-api"
          className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
        >
          <h3 className="text-xl font-bold mb-2">Admin API</h3>
          <p className="text-gray-600 mb-2">
            Manage accounts, projects, and service configuration.
          </p>
          <div className="text-primary">View documentation →</div>
        </Link>
      </div>
      
      <h2>Common API Patterns</h2>
      
      <div className="my-8">
        <h3>Pagination</h3>
        <p>
          Endpoints that return lists of resources support pagination using <code>limit</code> and <code>offset</code> parameters:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`# Get the first 10 functions
GET /v1/functions?limit=10&offset=0

# Get the next 10 functions
GET /v1/functions?limit=10&offset=10`}</pre>

        <p>
          Pagination information is included in the response:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}`}</pre>
        
        <h3>Filtering</h3>
        <p>
          Many list endpoints support filtering using query parameters:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`# Get functions with a specific tag
GET /v1/functions?tag=production

# Get functions with multiple filters
GET /v1/functions?tag=production&status=active`}</pre>
        
        <h3>Sorting</h3>
        <p>
          List endpoints typically support sorting using <code>sort</code> and <code>order</code> parameters:
        </p>
        <pre className="bg-gray-100 p-4 rounded-md">
{`# Sort functions by creation date in descending order
GET /v1/functions?sort=createdAt&order=desc

# Sort functions by name in ascending order
GET /v1/functions?sort=name&order=asc`}</pre>
      </div>
      
      <h2>Error Codes</h2>
      
      <div className="my-8">
        <p>
          The API uses standard HTTP status codes and provides detailed error information 
          in the response body:
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Status Code</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Error Code</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">400</td>
                <td className="border border-gray-300 px-4 py-2">bad_request</td>
                <td className="border border-gray-300 px-4 py-2">The request was malformed or contained invalid parameters</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">401</td>
                <td className="border border-gray-300 px-4 py-2">unauthorized</td>
                <td className="border border-gray-300 px-4 py-2">Authentication failed or API key was missing</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">403</td>
                <td className="border border-gray-300 px-4 py-2">forbidden</td>
                <td className="border border-gray-300 px-4 py-2">The API key doesn&apos;t have permission to perform the requested action</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">404</td>
                <td className="border border-gray-300 px-4 py-2">not_found</td>
                <td className="border border-gray-300 px-4 py-2">The requested resource was not found</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">409</td>
                <td className="border border-gray-300 px-4 py-2">conflict</td>
                <td className="border border-gray-300 px-4 py-2">The request conflicts with the current state of the resource</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">429</td>
                <td className="border border-gray-300 px-4 py-2">rate_limit_exceeded</td>
                <td className="border border-gray-300 px-4 py-2">The rate limit for API requests has been exceeded</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">500</td>
                <td className="border border-gray-300 px-4 py-2">internal_error</td>
                <td className="border border-gray-300 px-4 py-2">An internal server error occurred</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">503</td>
                <td className="border border-gray-300 px-4 py-2">service_unavailable</td>
                <td className="border border-gray-300 px-4 py-2">The service is temporarily unavailable</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <h2>SDK Reference</h2>
      
      <div className="my-8">
        <p>
          In addition to the REST API, we provide SDKs for popular programming languages:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
          <Link
            href="/docs/sdk/javascript"
            className="block p-5 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-lg font-bold mb-1">JavaScript SDK</h3>
            <div className="text-primary text-sm">View documentation →</div>
          </Link>
          
          <Link
            href="/docs/sdk/python"
            className="block p-5 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-lg font-bold mb-1">Python SDK</h3>
            <div className="text-primary text-sm">View documentation →</div>
          </Link>
          
          <Link
            href="/docs/sdk/go"
            className="block p-5 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-lg font-bold mb-1">Go SDK</h3>
            <div className="text-primary text-sm">View documentation →</div>
          </Link>
        </div>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript SDK example
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

// Using the Functions API
async function listFunctions() {
  const functions = await serviceLayer.functions.list({
    limit: 10,
    offset: 0,
    sort: 'createdAt',
    order: 'desc'
  });
  
  console.log(functions);
}

listFunctions().catch(console.error);`}</pre>
      </div>
      
      <h2>Webhooks</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer can notify your application about events using webhooks:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// Example webhook payload for a function execution event
{
  "event": "function.execution.completed",
  "data": {
    "functionId": "func_1234567890",
    "executionId": "exec_abcdefghij",
    "status": "success",
    "duration": 127,
    "timestamp": "2023-07-01T12:34:56Z"
  }
}`}</pre>
        
        <p className="mt-4">
          For detailed information about webhooks, see the <Link href="/docs/api/webhooks" className="text-primary hover:underline">Webhooks documentation</Link>.
        </p>
      </div>
      
      <h2>API Versioning</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer API is versioned to ensure backward compatibility. The current version is <code>v1</code>.
        </p>
        <p>
          We may introduce new versions in the future to accommodate significant changes. When a new version is released, 
          older versions will be supported for at least 12 months.
        </p>
      </div>
      
      <h2>Need Help?</h2>
      
      <div className="my-8">
        <p>
          If you have questions or need assistance with the API, you can:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>View examples in the <Link href="/docs/examples" className="text-primary hover:underline">Examples section</Link></li>
          <li>Check the <Link href="/docs/faq" className="text-primary hover:underline">FAQ</Link> for common questions</li>
          <li>Join our <a href="https://discord.gg/r3e-network" className="text-primary hover:underline">Discord community</a> for real-time help</li>
          <li>Contact our support team through the <Link href="/contact" className="text-primary hover:underline">Contact page</Link></li>
        </ul>
      </div>
    </div>
  );
} 