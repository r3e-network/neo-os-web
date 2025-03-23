'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function AutomationApiPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Automation API Reference</h1>
      
      <p className="lead">
        The Automation API allows you to programmatically create and manage automated triggers and actions.
      </p>
      
      <Callout type="info">
        This is a basic version of the Automation API documentation. It will be expanded with more detailed content in future updates.
      </Callout>
      
      <h2 id="overview">API Overview</h2>
      
      <p>
        The Automation API provides endpoints for creating, retrieving, updating, and deleting automations. 
        Automations consist of triggers (conditions that initiate the automation) and actions (operations to perform when triggered).
      </p>
      
      <h2 id="base-url">Base URL</h2>
      
      <CodeBlock 
        language="text"
        code={`https://api.neoservicelayer.com/v1/automations`}
      />
      
      <h2 id="endpoints">Endpoints</h2>
      
      <div className="space-y-12">
        {/* List Automations */}
        <section className="border-b border-gray-200 pb-8">
          <h3 className="text-xl font-semibold" id="list-automations">List Automations</h3>
          <p>Retrieves a list of automations in your account.</p>
          
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="font-mono font-bold text-green-700 mb-2">GET /automations</p>
            
            <h4 className="text-lg font-semibold">Query Parameters</h4>
            <ul>
              <li><code>status</code> (optional) - Filter by status: "active", "inactive", "error"</li>
              <li><code>triggerType</code> (optional) - Filter by trigger type: "schedule", "blockchain", "price"</li>
              <li><code>limit</code> (optional) - Number of items to return (default: 20, max: 100)</li>
              <li><code>offset</code> (optional) - Pagination offset (default: 0)</li>
            </ul>
            
            <h4 className="text-lg font-semibold">Example Request</h4>
            <CodeBlock 
              language="bash"
              code={`curl -X GET "https://api.neoservicelayer.com/v1/automations?status=active" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
            />
            
            <h4 className="text-lg font-semibold">Response</h4>
            <CodeBlock 
              language="json"
              code={`{
  "automations": [
    {
      "id": "auto_123456789",
      "name": "Daily Update",
      "status": "active",
      "trigger": {
        "type": "schedule",
        "cron": "0 0 * * *"
      },
      "action": {
        "type": "function",
        "functionId": "func_abcdef123",
        "parameters": {
          "operation": "daily-update"
        }
      },
      "createdAt": "2023-03-15T10:30:45Z",
      "updatedAt": "2023-03-15T10:30:45Z"
    },
    {
      "id": "auto_987654321",
      "name": "Price Alert",
      "status": "active",
      "trigger": {
        "type": "price",
        "asset": "NEO",
        "condition": "above",
        "value": "50.00",
        "currency": "USD"
      },
      "action": {
        "type": "function",
        "functionId": "func_xyz789",
        "parameters": {
          "notify": true
        }
      },
      "createdAt": "2023-03-10T15:20:30Z",
      "updatedAt": "2023-03-10T15:20:30Z"
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 20,
    "offset": 0
  }
}`}
            />
          </div>
        </section>
        
        {/* Create Automation */}
        <section className="border-b border-gray-200 pb-8">
          <h3 className="text-xl font-semibold" id="create-automation">Create Automation</h3>
          <p>Creates a new automation in your account.</p>
          
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="font-mono font-bold text-blue-700 mb-2">POST /automations</p>
            
            <h4 className="text-lg font-semibold">Request Body</h4>
            <CodeBlock 
              language="json"
              code={`{
  "name": "Daily Update",
  "trigger": {
    "type": "schedule",
    "cron": "0 0 * * *"
  },
  "action": {
    "type": "function",
    "functionId": "func_abcdef123",
    "parameters": {
      "operation": "daily-update"
    }
  },
  "status": "active"
}`}
            />
            
            <h4 className="text-lg font-semibold">Example Request</h4>
            <CodeBlock 
              language="bash"
              code={`curl -X POST "https://api.neoservicelayer.com/v1/automations" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Daily Update",
    "trigger": {
      "type": "schedule",
      "cron": "0 0 * * *"
    },
    "action": {
      "type": "function",
      "functionId": "func_abcdef123",
      "parameters": {
        "operation": "daily-update"
      }
    },
    "status": "active"
  }'`}
            />
            
            <h4 className="text-lg font-semibold">Response</h4>
            <CodeBlock 
              language="json"
              code={`{
  "id": "auto_123456789",
  "name": "Daily Update",
  "status": "active",
  "trigger": {
    "type": "schedule",
    "cron": "0 0 * * *"
  },
  "action": {
    "type": "function",
    "functionId": "func_abcdef123",
    "parameters": {
      "operation": "daily-update"
    }
  },
  "createdAt": "2023-03-15T10:30:45Z",
  "updatedAt": "2023-03-15T10:30:45Z"
}`}
            />
          </div>
        </section>
        
        {/* Get Automation */}
        <section>
          <h3 className="text-xl font-semibold" id="get-automation">Get Automation</h3>
          <p>Retrieves information about a specific automation.</p>
          
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="font-mono font-bold text-green-700 mb-2">GET /automations/{`{automationId}`}</p>
            
            <h4 className="text-lg font-semibold">Path Parameters</h4>
            <ul>
              <li><code>automationId</code> (required) - The ID of the automation to retrieve</li>
            </ul>
            
            <h4 className="text-lg font-semibold">Example Request</h4>
            <CodeBlock 
              language="bash"
              code={`curl -X GET "https://api.neoservicelayer.com/v1/automations/auto_123456789" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
            />
            
            <h4 className="text-lg font-semibold">Response</h4>
            <CodeBlock 
              language="json"
              code={`{
  "id": "auto_123456789",
  "name": "Daily Update",
  "status": "active",
  "trigger": {
    "type": "schedule",
    "cron": "0 0 * * *"
  },
  "action": {
    "type": "function",
    "functionId": "func_abcdef123",
    "parameters": {
      "operation": "daily-update"
    }
  },
  "executionStats": {
    "lastExecution": "2023-03-15T00:00:00Z",
    "lastStatus": "success",
    "successCount": 15,
    "failureCount": 0,
    "nextExecution": "2023-03-16T00:00:00Z"
  },
  "createdAt": "2023-03-01T10:30:45Z",
  "updatedAt": "2023-03-15T10:30:45Z"
}`}
            />
          </div>
        </section>
      </div>
      
      <h2 id="trigger-types">Supported Trigger Types</h2>
      
      <h3 id="schedule-trigger">Schedule Trigger</h3>
      
      <p>
        Executes an action based on a schedule defined using cron syntax.
      </p>
      
      <CodeBlock 
        language="json"
        code={`{
  "type": "schedule",
  "cron": "0 0 * * *" // Daily at midnight
}`}
      />
      
      <h3 id="blockchain-trigger">Blockchain Trigger</h3>
      
      <p>
        Executes an action in response to blockchain events, such as contract notifications.
      </p>
      
      <CodeBlock 
        language="json"
        code={`{
  "type": "blockchain",
  "scriptHash": "0x1234567890abcdef1234567890abcdef12345678",
  "event": "Transfer", // Optional: Filter by specific event
  "filter": {          // Optional: Filter by event parameters
    "from": "NXV6HUtNX3bkWFw2ESjkQZj8b5AV2CRnrP"
  }
}`}
      />
      
      <h3 id="price-trigger">Price Trigger</h3>
      
      <p>
        Executes an action when an asset's price meets a specific condition.
      </p>
      
      <CodeBlock 
        language="json"
        code={`{
  "type": "price",
  "asset": "NEO",
  "condition": "above", // "above" or "below"
  "value": "50.00",
  "currency": "USD"
}`}
      />
      
      <h2 id="action-types">Supported Action Types</h2>
      
      <h3 id="function-action">Function Action</h3>
      
      <p>
        Executes a deployed Function with the specified parameters.
      </p>
      
      <CodeBlock 
        language="json"
        code={`{
  "type": "function",
  "functionId": "func_abcdef123",
  "parameters": {
    // Any parameters to pass to the function
    "operation": "daily-update"
  }
}`}
      />
      
      <h3 id="contract-action">Contract Action</h3>
      
      <p>
        Invokes a smart contract method on the Neo N3 blockchain.
      </p>
      
      <CodeBlock 
        language="json"
        code={`{
  "type": "contract",
  "scriptHash": "0x1234567890abcdef1234567890abcdef12345678",
  "operation": "transfer",
  "args": [
    {
      "type": "Hash160",
      "value": "NXV6HUtNX3bkWFw2ESjkQZj8b5AV2CRnrP"
    },
    {
      "type": "Integer",
      "value": "100000000" // 1 GAS in smallest units
    }
  ]
}`}
      />
      
      <h2 id="error-codes">Error Codes</h2>
      
      <div className="overflow-x-auto my-8">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">400</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">INVALID_REQUEST</td>
              <td className="px-6 py-4 text-sm text-gray-500">The request was invalid or missing required parameters</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">400</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">INVALID_CRON</td>
              <td className="px-6 py-4 text-sm text-gray-500">The provided cron expression is invalid</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">400</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">INVALID_SCRIPT_HASH</td>
              <td className="px-6 py-4 text-sm text-gray-500">The provided script hash is invalid</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">404</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">FUNCTION_NOT_FOUND</td>
              <td className="px-6 py-4 text-sm text-gray-500">The specified function does not exist</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">404</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">AUTOMATION_NOT_FOUND</td>
              <td className="px-6 py-4 text-sm text-gray-500">The specified automation does not exist</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <h2 id="further-learning">Further Learning</h2>
      
      <p>
        For more information on creating and using automations, see the 
        <Link href="/docs/guides/automation-guide" className="text-primary hover:underline"> Setting Up Automation Guide</Link>.
      </p>
    </div>
  );
}