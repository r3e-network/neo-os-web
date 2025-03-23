"use client";

import Link from 'next/link';

export default function FunctionsApiDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Functions API Reference</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Functions API allows you to create, manage, and invoke JavaScript functions
          in a secure Trusted Execution Environment (TEE). This API enables serverless
          function execution with integration to the Neo N3 blockchain.
        </p>
      </div>
      
      <h2>Base URL</h2>
      <pre className="bg-gray-100 p-4 rounded-md">https://api.neo-service-layer.io/v1/functions</pre>
      
      <h2>Authentication</h2>
      <p>
        All API requests require authentication using an API key. Include your API key in the 
        <code>X-API-Key</code> header with each request:
      </p>
      <pre className="bg-gray-100 p-4 rounded-md">
{`curl -X GET "https://api.neo-service-layer.io/v1/functions" \\
  -H "X-API-Key: your-api-key-here"`}</pre>
      
      <h2>Endpoints</h2>
      
      <div className="my-8">
        <h3 className="text-xl font-semibold">Functions Management</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Method</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Endpoint</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>GET</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions</code></td>
                <td className="border border-gray-300 px-4 py-2">List all functions</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2"><code>POST</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions</code></td>
                <td className="border border-gray-300 px-4 py-2">Create a new function</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>GET</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}</code></td>
                <td className="border border-gray-300 px-4 py-2">Get a specific function</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2"><code>PUT</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}</code></td>
                <td className="border border-gray-300 px-4 py-2">Update a function</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>DELETE</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}</code></td>
                <td className="border border-gray-300 px-4 py-2">Delete a function</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <h3 className="text-xl font-semibold mt-8">Function Execution</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Method</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Endpoint</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>POST</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}/invoke</code></td>
                <td className="border border-gray-300 px-4 py-2">Invoke a function</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2"><code>GET</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}/executions</code></td>
                <td className="border border-gray-300 px-4 py-2">List function executions</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>GET</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}/executions/{'{executionId}'}</code></td>
                <td className="border border-gray-300 px-4 py-2">Get execution details</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <h3 className="text-xl font-semibold mt-8">Function Secrets & Environment</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Method</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Endpoint</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>GET</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}/environment</code></td>
                <td className="border border-gray-300 px-4 py-2">Get function environment variables</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2"><code>PUT</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}/environment</code></td>
                <td className="border border-gray-300 px-4 py-2">Update environment variables</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>PUT</code></td>
                <td className="border border-gray-300 px-4 py-2"><code>/functions/{'{functionId}'}/secrets</code></td>
                <td className="border border-gray-300 px-4 py-2">Update function secrets access</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <h2>Request and Response Formats</h2>
      <p>
        All API requests and responses use JSON format. Specific formats for each endpoint are detailed below.
      </p>

      <div className="my-12 space-y-16">
        <div>
          <h3 id="list-functions" className="text-2xl font-bold pb-2 border-b border-gray-200">
            List Functions
          </h3>
          
          <p className="my-4">
            Retrieves a list of functions in your account. The results can be filtered and paginated.
          </p>
          
          <p className="font-medium">Endpoint: <code>GET /functions</code></p>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Query Parameters</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>limit</code></td>
                    <td className="border border-gray-300 px-4 py-2">Integer</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Maximum number of functions to return (default: 10, max: 100)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>offset</code></td>
                    <td className="border border-gray-300 px-4 py-2">Integer</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Number of functions to skip (default: 0)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>tag</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Filter functions by tag</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>runtime</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Filter functions by runtime (e.g., node16)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>sort</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Sort by field (createdAt, name, updatedAt)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>order</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Sort order (asc, desc)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Response</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": [
    {
      "id": "func_1234567890",
      "name": "hello-world",
      "description": "A simple hello world function",
      "runtime": "node16",
      "status": "active",
      "createdAt": "2023-07-01T12:34:56Z",
      "updatedAt": "2023-07-01T12:34:56Z",
      "tags": ["example", "demo"],
      "lastInvocation": "2023-07-02T10:21:45Z"
    },
    {
      "id": "func_0987654321",
      "name": "token-price-checker",
      "description": "Checks token prices",
      "runtime": "node16",
      "status": "active",
      "createdAt": "2023-06-30T14:22:33Z",
      "updatedAt": "2023-06-30T14:22:33Z",
      "tags": ["price", "token"],
      "lastInvocation": "2023-07-01T09:11:22Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}`}</pre>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Code Example</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using Fetch API
fetch('https://api.neo-service-layer.io/v1/functions?limit=10&offset=0&sort=createdAt&order=desc', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

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
        </div>
        
        <div>
          <h3 id="create-function" className="text-2xl font-bold pb-2 border-b border-gray-200">
            Create a Function
          </h3>
          
          <p className="my-4">
            Creates a new function with the specified code and configuration.
          </p>
          
          <p className="font-medium">Endpoint: <code>POST /functions</code></p>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Request Body</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>name</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">Yes</td>
                    <td className="border border-gray-300 px-4 py-2">Function name (alphanumeric with hyphens, max 64 chars)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>code</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">Yes</td>
                    <td className="border border-gray-300 px-4 py-2">JavaScript code for the function</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>runtime</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">Yes</td>
                    <td className="border border-gray-300 px-4 py-2">Runtime environment (node16, node18)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>description</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Function description</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>timeout</code></td>
                    <td className="border border-gray-300 px-4 py-2">Integer</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Maximum execution time in seconds (default: 30, max: 300)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>environment</code></td>
                    <td className="border border-gray-300 px-4 py-2">Object</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Environment variables as key-value pairs</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>secrets</code></td>
                    <td className="border border-gray-300 px-4 py-2">Array</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Array of secret names to make available to the function</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>tags</code></td>
                    <td className="border border-gray-300 px-4 py-2">Array</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Array of tags for organizing functions</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Response</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": {
    "id": "func_1234567890",
    "name": "hello-world",
    "description": "A simple hello world function",
    "runtime": "node16",
    "timeout": 30,
    "code": "module.exports = async function(context) { ... }",
    "status": "active",
    "createdAt": "2023-07-01T12:34:56Z",
    "updatedAt": "2023-07-01T12:34:56Z",
    "tags": ["example", "demo"],
    "environment": {
      "LOG_LEVEL": "info"
    },
    "secrets": ["api-key-1"]
  }
}`}</pre>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Code Example</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using Fetch API
const functionCode = \`
  module.exports = async function(context) {
    const { params } = context;
    return {
      message: \`Hello, \${params.name || 'World'}!\`,
      timestamp: new Date().toISOString()
    };
  };
\`;

fetch('https://api.neo-service-layer.io/v1/functions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  },
  body: JSON.stringify({
    name: 'hello-world',
    code: functionCode,
    runtime: 'node16',
    description: 'A simple hello world function',
    environment: {
      LOG_LEVEL: 'info'
    },
    secrets: ['api-key-1'],
    tags: ['example', 'demo']
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

async function createFunction() {
  const functionCode = \`
    module.exports = async function(context) {
      const { params } = context;
      return {
        message: \`Hello, \${params.name || 'World'}!\`,
        timestamp: new Date().toISOString()
      };
    };
  \`;
  
  const result = await serviceLayer.functions.create({
    name: 'hello-world',
    code: functionCode,
    runtime: 'node16',
    description: 'A simple hello world function',
    environment: {
      LOG_LEVEL: 'info'
    },
    secrets: ['api-key-1'],
    tags: ['example', 'demo']
  });
  
  console.log(result);
}

createFunction().catch(console.error);`}</pre>
          </div>
        </div>
        
        <div>
          <h3 id="get-function" className="text-2xl font-bold pb-2 border-b border-gray-200">
            Get a Function
          </h3>
          
          <p className="my-4">
            Retrieves details of a specific function by its ID.
          </p>
          
          <p className="font-medium">Endpoint: <code>GET /functions/{'{functionId}'}</code></p>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Path Parameters</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>functionId</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">Yes</td>
                    <td className="border border-gray-300 px-4 py-2">Unique identifier of the function</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Query Parameters</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>include_code</code></td>
                    <td className="border border-gray-300 px-4 py-2">Boolean</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Include function code in the response (default: false)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Response</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": {
    "id": "func_1234567890",
    "name": "hello-world",
    "description": "A simple hello world function",
    "runtime": "node16",
    "timeout": 30,
    "status": "active",
    "createdAt": "2023-07-01T12:34:56Z",
    "updatedAt": "2023-07-01T12:34:56Z",
    "tags": ["example", "demo"],
    "code": "module.exports = async function(context) { ... }", // Only included if include_code=true
    "environment": {
      "LOG_LEVEL": "info"
    },
    "secrets": ["api-key-1"],
    "stats": {
      "invocations": {
        "total": 152,
        "success": 149,
        "failed": 3,
        "last24Hours": 23
      },
      "averageExecutionTime": 78, // milliseconds
      "lastInvocation": "2023-07-02T10:21:45Z"
    }
  }
}`}</pre>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Code Example</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using Fetch API
fetch('https://api.neo-service-layer.io/v1/functions/func_1234567890?include_code=true', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

async function getFunction() {
  const functionDetails = await serviceLayer.functions.get('func_1234567890', {
    includeCode: true
  });
  
  console.log(functionDetails);
}

getFunction().catch(console.error);`}</pre>
          </div>
        </div>
        
        <div>
          <h3 id="invoke-function" className="text-2xl font-bold pb-2 border-b border-gray-200">
            Invoke a Function
          </h3>
          
          <p className="my-4">
            Executes a function with the provided parameters and returns the result.
          </p>
          
          <p className="font-medium">Endpoint: <code>POST /functions/{'{functionId}'}/invoke</code></p>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Path Parameters</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>functionId</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">Yes</td>
                    <td className="border border-gray-300 px-4 py-2">Unique identifier of the function</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Request Body</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>params</code></td>
                    <td className="border border-gray-300 px-4 py-2">Object</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Parameters to pass to the function</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>async</code></td>
                    <td className="border border-gray-300 px-4 py-2">Boolean</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Execute asynchronously (default: false)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Response (Synchronous Execution)</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": {
    "execution": {
      "id": "exec_abcdefghij",
      "status": "completed",
      "startedAt": "2023-07-01T12:34:56Z",
      "completedAt": "2023-07-01T12:34:57Z",
      "duration": 127 // milliseconds
    },
    "result": {
      // Function result (any JSON serializable value)
      "message": "Hello, Neo!",
      "timestamp": "2023-07-01T12:34:57Z"
    }
  }
}`}</pre>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Response (Asynchronous Execution)</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": {
    "execution": {
      "id": "exec_abcdefghij",
      "status": "running",
      "startedAt": "2023-07-01T12:34:56Z"
    }
  }
}`}</pre>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Code Example</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using Fetch API
fetch('https://api.neo-service-layer.io/v1/functions/func_1234567890/invoke', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  },
  body: JSON.stringify({
    params: {
      name: 'Neo'
    },
    async: false
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

async function invokeFunction() {
  const result = await serviceLayer.functions.invoke('func_1234567890', {
    name: 'Neo'
  });
  
  console.log(result);
}

invokeFunction().catch(console.error);`}</pre>
          </div>
        </div>
        
        <div>
          <h3 id="function-executions" className="text-2xl font-bold pb-2 border-b border-gray-200">
            List Function Executions
          </h3>
          
          <p className="my-4">
            Retrieves the execution history for a specific function.
          </p>
          
          <p className="font-medium">Endpoint: <code>GET /functions/{'{functionId}'}/executions</code></p>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Path Parameters</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>functionId</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">Yes</td>
                    <td className="border border-gray-300 px-4 py-2">Unique identifier of the function</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Query Parameters</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parameter</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Required</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>limit</code></td>
                    <td className="border border-gray-300 px-4 py-2">Integer</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Maximum number of executions to return (default: 10, max: 100)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>offset</code></td>
                    <td className="border border-gray-300 px-4 py-2">Integer</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Number of executions to skip (default: 0)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>status</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Filter by status (completed, failed, running)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2"><code>start_date</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Filter executions after this date (ISO 8601 format)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2"><code>end_date</code></td>
                    <td className="border border-gray-300 px-4 py-2">String</td>
                    <td className="border border-gray-300 px-4 py-2">No</td>
                    <td className="border border-gray-300 px-4 py-2">Filter executions before this date (ISO 8601 format)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Response</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": true,
  "data": [
    {
      "id": "exec_abcdefghij",
      "status": "completed",
      "startedAt": "2023-07-01T12:34:56Z",
      "completedAt": "2023-07-01T12:34:57Z",
      "duration": 127,
      "params": {
        "name": "Neo"
      },
      "hasResult": true,
      "hasError": false
    },
    {
      "id": "exec_klmnopqrst",
      "status": "failed",
      "startedAt": "2023-07-01T12:32:10Z",
      "completedAt": "2023-07-01T12:32:12Z",
      "duration": 2045,
      "params": {
        "name": 123 // Caused an error
      },
      "hasResult": false,
      "hasError": true
    }
  ],
  "pagination": {
    "total": 32,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}`}</pre>
          </div>
          
          <div className="my-6">
            <h4 className="text-lg font-semibold">Code Example</h4>
            <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using Fetch API
fetch('https://api.neo-service-layer.io/v1/functions/func_1234567890/executions?limit=10&status=completed', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));

// Using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

async function listExecutions() {
  const executions = await serviceLayer.functions.listExecutions('func_1234567890', {
    limit: 10,
    status: 'completed'
  });
  
  console.log(executions);
}

listExecutions().catch(console.error);`}</pre>
          </div>
        </div>
      </div>
      
      <h2>Function Runtime Context</h2>
      
      <div className="my-8">
        <p>
          When your function is executed, it receives a <code>context</code> object with the following properties:
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Property</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>params</code></td>
                <td className="border border-gray-300 px-4 py-2">Object</td>
                <td className="border border-gray-300 px-4 py-2">Parameters passed to the function during invocation</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2"><code>execution</code></td>
                <td className="border border-gray-300 px-4 py-2">Object</td>
                <td className="border border-gray-300 px-4 py-2">Information about the current execution (id, startedAt)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>environment</code></td>
                <td className="border border-gray-300 px-4 py-2">Object</td>
                <td className="border border-gray-300 px-4 py-2">Environment variables defined for the function</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2"><code>secrets</code></td>
                <td className="border border-gray-300 px-4 py-2">Object</td>
                <td className="border border-gray-300 px-4 py-2">Secret values the function has access to</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2"><code>services</code></td>
                <td className="border border-gray-300 px-4 py-2">Object</td>
                <td className="border border-gray-300 px-4 py-2">Service clients (blockchain, random, etc.)</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2"><code>log</code></td>
                <td className="border border-gray-300 px-4 py-2">Object</td>
                <td className="border border-gray-300 px-4 py-2">Logging functions (log.info, log.error, etc.)</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="mt-6">
          <h4 className="text-lg font-semibold">Example Function Using Context</h4>
          <pre className="bg-gray-100 p-4 rounded-md">
{`module.exports = async function(context) {
  const { params, environment, secrets, services, log } = context;
  
  // Log information about the execution
  log.info('Function executed with params:', params);
  
  // Access environment variables
  const logLevel = environment.LOG_LEVEL || 'info';
  log.info('Current log level:', logLevel);
  
  // Use a secret
  const apiKey = secrets['external-api-key'];
  log.info('Using API key:', apiKey.substring(0, 3) + '...');
  
  // Use Neo blockchain service
  const neoBalance = await services.blockchain.getBalance({
    address: params.address,
    asset: services.blockchain.assets.NEO
  });
  
  return {
    message: \`Hello, \${params.name || 'World'}!\`,
    neoBalance,
    timestamp: new Date().toISOString()
  };
};`}</pre>
        </div>
      </div>
      
      <h2>Error Handling</h2>
      
      <div className="my-8">
        <p>
          The Functions API returns standard HTTP status codes along with detailed error information:
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
                <td className="border border-gray-300 px-4 py-2">invalid_request</td>
                <td className="border border-gray-300 px-4 py-2">The request was malformed or contained invalid parameters</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">400</td>
                <td className="border border-gray-300 px-4 py-2">invalid_function_code</td>
                <td className="border border-gray-300 px-4 py-2">The function code is invalid or contains syntax errors</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">401</td>
                <td className="border border-gray-300 px-4 py-2">unauthorized</td>
                <td className="border border-gray-300 px-4 py-2">Authentication failed or API key was missing</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">403</td>
                <td className="border border-gray-300 px-4 py-2">forbidden</td>
                <td className="border border-gray-300 px-4 py-2">The API key doesn&apos;t have permission to perform the requested action</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">404</td>
                <td className="border border-gray-300 px-4 py-2">function_not_found</td>
                <td className="border border-gray-300 px-4 py-2">The requested function was not found</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">404</td>
                <td className="border border-gray-300 px-4 py-2">execution_not_found</td>
                <td className="border border-gray-300 px-4 py-2">The requested execution was not found</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">429</td>
                <td className="border border-gray-300 px-4 py-2">rate_limit_exceeded</td>
                <td className="border border-gray-300 px-4 py-2">The rate limit for API requests has been exceeded</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">500</td>
                <td className="border border-gray-300 px-4 py-2">execution_error</td>
                <td className="border border-gray-300 px-4 py-2">An error occurred during function execution</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">500</td>
                <td className="border border-gray-300 px-4 py-2">internal_error</td>
                <td className="border border-gray-300 px-4 py-2">An internal server error occurred</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="mt-6">
          <h4 className="text-lg font-semibold">Error Response Example</h4>
          <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "success": false,
  "error": {
    "code": "execution_error",
    "message": "An error occurred during function execution",
    "details": {
      "name": "TypeError",
      "message": "Cannot read property 'toLowerCase' of undefined",
      "stack": "TypeError: Cannot read property 'toLowerCase' of undefined\\n    at module.exports (/function/index.js:5:23)\\n    at Runtime.handleMessage (/runtime/index.js:42:10)"
    }
  }
}`}</pre>
        </div>
      </div>
      
      <h2>SDK Reference</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer SDK provides a convenient way to interact with the Functions API:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript SDK example
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

// Access the Functions service
const functionsService = serviceLayer.functions;

// Available methods
functionsService.list() // List all functions
functionsService.create() // Create a new function
functionsService.get() // Get a specific function
functionsService.update() // Update a function
functionsService.delete() // Delete a function
functionsService.invoke() // Invoke a function
functionsService.listExecutions() // List function executions
functionsService.getExecution() // Get execution details`}</pre>
        
        <p className="mt-4">
          For more details about the SDK, see the <Link href="/docs/sdk/javascript" className="text-primary hover:underline">JavaScript SDK documentation</Link>.
        </p>
      </div>
      
      <div className="my-8 border-t border-gray-200 pt-8">
        <h2>Additional Resources</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
          <Link 
            href="/docs/services/functions" 
            className="block p-5 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-lg font-bold mb-1">Functions Service</h3>
            <p className="text-sm text-gray-600 mb-2">
              Learn about the Functions service and how to use it
            </p>
            <div className="text-primary text-sm">View documentation →</div>
          </Link>
          
          <Link 
            href="/docs/examples/functions" 
            className="block p-5 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-lg font-bold mb-1">Function Examples</h3>
            <p className="text-sm text-gray-600 mb-2">
              Explore examples and use cases for the Functions service
            </p>
            <div className="text-primary text-sm">View examples →</div>
          </Link>
          
          <Link 
            href="/docs/tutorials/functions" 
            className="block p-5 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-lg font-bold mb-1">Function Tutorials</h3>
            <p className="text-sm text-gray-600 mb-2">
              Follow step-by-step tutorials for building with Functions
            </p>
            <div className="text-primary text-sm">View tutorials →</div>
          </Link>
        </div>
      </div>
    </div>
  );
} 