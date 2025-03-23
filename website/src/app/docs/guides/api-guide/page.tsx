'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';
import CodeTabs from '@/components/docs/CodeTabs';

export default function ApiGuidePage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Using the API Guide</h1>
      
      <p className="lead">
        Learn how to interact with the Neo Service Layer API to programmatically manage resources and services.
      </p>
      
      <Callout type="info">
        This is a basic version of the API guide. It will be expanded with more detailed content in future updates.
      </Callout>
      
      <h2 id="api-overview">API Overview</h2>
      
      <p>
        The Neo Service Layer API follows RESTful principles, using standard HTTP methods and JSON payloads. 
        All endpoints require authentication using API keys.
      </p>
      
      <h3 id="base-url">Base URL</h3>
      
      <CodeBlock 
        language="text"
        code={`https://api.neoservicelayer.com/v1`}
      />
      
      <h2 id="authentication">Authentication</h2>
      
      <p>
        All API requests require an API key, which should be included in the HTTP headers:
      </p>
      
      <CodeBlock 
        language="javascript"
        code={`Authorization: Bearer YOUR_API_KEY`}
      />
      
      <h2 id="example-requests">Example Requests</h2>
      
      <p>Here are examples of common API operations using different languages:</p>
      
      <h3 id="listing-functions">Listing Functions</h3>
      
      <CodeTabs
        tabs={[
          {
            label: 'cURL',
            language: 'bash',
            code: `curl -X GET "https://api.neoservicelayer.com/v1/functions" \\
  -H "Authorization: Bearer YOUR_API_KEY"`
          },
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `// Using the JavaScript SDK
import { NeoServiceLayer } from 'neo-service-layer-sdk';

const serviceLayer = new NeoServiceLayer({
  apiKey: 'YOUR_API_KEY',
  network: 'mainnet', // or 'testnet'
});

async function listFunctions() {
  const functions = await serviceLayer.functions.list();
  console.log('Functions:', functions);
}

listFunctions();`
          },
          {
            label: 'Go',
            language: 'go',
            code: `package main

import (
    "fmt"
    
    nsl "github.com/neo-service-layer/sdk"
)

func main() {
    client := nsl.NewClient(nsl.Config{
        APIKey:  "YOUR_API_KEY",
        Network: "mainnet", // or "testnet"
    })
    
    // List functions
    functions, err := client.Functions.List(nil)
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }
    
    fmt.Printf("Functions: %+v\\n", functions)
}`
          }
        ]}
        caption="Examples of listing functions using different languages"
      />
      
      <h2 id="response-handling">Response Handling</h2>
      
      <p>
        API responses follow a consistent format with HTTP status codes indicating success or failure:
      </p>
      
      <ul>
        <li><strong>2xx</strong>: Success</li>
        <li><strong>4xx</strong>: Client error (invalid parameters, unauthorized, etc.)</li>
        <li><strong>5xx</strong>: Server error</li>
      </ul>
      
      <p>
        Error responses include a message explaining what went wrong:
      </p>
      
      <CodeBlock 
        language="json"
        code={`{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The provided parameters are invalid",
    "details": {
      "field": "functionName",
      "issue": "must be between 3 and 64 characters"
    }
  }
}`}
      />
      
      <h2 id="rate-limiting">Rate Limiting</h2>
      
      <p>
        API requests are subject to rate limiting to ensure fair usage. Rate limits vary by endpoint 
        and account tier. When you exceed the rate limit, you'll receive a 429 response.
      </p>
      
      <Callout type="tip">
        The <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code> headers in API responses 
        tell you how many requests you have left and when your limit will reset.
      </Callout>
      
      <h2 id="further-learning">Further API Documentation</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
        <Link 
          href="/docs/api/authentication" 
          className="block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
        >
          <h3 className="text-xl font-bold mb-2">Authentication</h3>
          <p className="text-gray-600">Learn more about API authentication and tokens</p>
        </Link>
        
        <Link 
          href="/docs/api/functions-api" 
          className="block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
        >
          <h3 className="text-xl font-bold mb-2">Functions API</h3>
          <p className="text-gray-600">Create and manage functions</p>
        </Link>
        
        <Link 
          href="/docs/api/automation-api" 
          className="block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
        >
          <h3 className="text-xl font-bold mb-2">Automation API</h3>
          <p className="text-gray-600">Set up automated triggers and actions</p>
        </Link>
        
        <Link 
          href="/docs/api/secrets-api" 
          className="block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
        >
          <h3 className="text-xl font-bold mb-2">Secrets API</h3>
          <p className="text-gray-600">Manage sensitive information securely</p>
        </Link>
      </div>
    </div>
  );
}