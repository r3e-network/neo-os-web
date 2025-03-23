"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function GettingStartedDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Getting Started with Neo Service Layer</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Neo Service Layer provides a suite of services that enhance your Neo N3 blockchain applications.
          This guide will help you get started with setting up and using the Service Layer.
        </p>
      </div>

      <h2>What You&apos;ll Need</h2>
      
      <div className="my-8">
        <ul className="list-disc pl-6 space-y-2">
          <li>A Neo N3 wallet (NeoLine, O3, Neon, or OneGate)</li>
          <li>Basic knowledge of Neo N3 blockchain and smart contracts</li>
          <li>A text editor or IDE for development</li>
          <li>Node.js installed (for JavaScript/TypeScript development)</li>
        </ul>
      </div>
      
      <h2>Creating an Account</h2>
      
      <div className="my-8">
        <ol className="list-decimal pl-6 space-y-4">
          <li>
            <p>
              <strong>Sign up:</strong> Visit the <Link href="/signup" className="text-primary hover:underline">Sign Up page</Link> to create an account.
            </p>
          </li>
          <li>
            <p>
              <strong>Connect your wallet:</strong> Use one of the supported Neo N3 wallets to connect to the service. 
              Your wallet address will be linked to your account.
            </p>
            <Image 
              src="/images/docs/connect-wallet.png" 
              alt="Connect Wallet Interface" 
              width={400} 
              height={250}
              className="my-4 border rounded-lg shadow-sm"
              style={{maxWidth: '100%', height: 'auto'}}
            />
          </li>
          <li>
            <p>
              <strong>Create a project:</strong> From your dashboard, create a new project by clicking the 
              &quot;Create Project&quot; button and providing a name and description.
            </p>
          </li>
          <li>
            <p>
              <strong>Generate API keys:</strong> In your project settings, generate API keys that you&apos;ll
              use to authenticate with the Service Layer.
            </p>
          </li>
        </ol>
      </div>
      
      <h2>Authentication</h2>
      
      <div className="my-8">
        <p>
          To interact with the Neo Service Layer API, you need to authenticate using your API key:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example
const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': 'your-api-key-here'
};

// Example API request
fetch('https://api.neo-service-layer.io/v1/functions', {
  method: 'GET',
  headers: headers
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`}</pre>

        <div className="mt-6">
          <p>
            Alternatively, use our SDK which handles authentication for you:
          </p>
          
          <pre className="bg-gray-100 p-4 rounded-md">
{`// Install the SDK
npm install neo-service-layer-sdk

// JavaScript example
const { NeoServiceLayer } = require('neo-service-layer-sdk');

// Initialize with your API key
const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

// Now you can access services
const functionsService = serviceLayer.functions;
const secretsService = serviceLayer.secrets;
// etc.`}</pre>
        </div>
      </div>
      
      <h2>Quick Start Examples</h2>
      
      <div className="my-8">
        <h3>Example 1: Create and Deploy a Function</h3>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

async function deployFunction() {
  // Create a simple function
  const functionCode = \`
    module.exports = async function(context) {
      const { params } = context;
      return {
        message: \`Hello, \${params.name || 'World'}!\`,
        timestamp: new Date().toISOString()
      };
    };
  \`;
  
  // Deploy the function
  const result = await serviceLayer.functions.create({
    name: 'hello-world',
    code: functionCode,
    runtime: 'node16',
    description: 'A simple hello world function'
  });
  
  console.log('Function deployed:', result);
  
  // Invoke the function
  const response = await serviceLayer.functions.invoke('hello-world', {
    name: 'Neo'
  });
  
  console.log('Function response:', response);
}

deployFunction().catch(console.error);`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Example 2: Store and Retrieve a Secret</h3>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

async function manageSecrets() {
  // Store an API key as a secret
  await serviceLayer.secrets.set({
    name: 'external-api-key',
    value: 'my-api-key-value',
    description: 'API key for external service'
  });
  
  console.log('Secret stored successfully');
  
  // Use the secret in a function
  const functionCode = \`
    module.exports = async function(context) {
      // Access the secret
      const apiKey = context.secrets['external-api-key'];
      
      // Use the API key (in a real scenario, you'd make an API call)
      return {
        message: 'Successfully used the API key',
        keyFirstChars: apiKey.substring(0, 3) + '...'
      };
    };
  \`;
  
  // Deploy the function that uses the secret
  const result = await serviceLayer.functions.create({
    name: 'use-secret-function',
    code: functionCode,
    runtime: 'node16',
    description: 'Function that uses a secret',
    secrets: ['external-api-key'] // Request access to this secret
  });
  
  // Invoke the function
  const response = await serviceLayer.functions.invoke('use-secret-function');
  
  console.log('Function response:', response);
}

manageSecrets().catch(console.error);`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Example 3: Set Up Contract Automation</h3>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using the SDK
const { NeoServiceLayer } = require('neo-service-layer-sdk');

const serviceLayer = new NeoServiceLayer({
  apiKey: 'your-api-key-here'
});

async function createAutomation() {
  // Create automation that triggers daily at midnight
  const automation = await serviceLayer.automation.create({
    name: 'daily-contract-update',
    description: 'Updates a contract value every day at midnight',
    
    // Trigger configuration (time-based)
    trigger: {
      type: 'schedule',
      schedule: '0 0 * * *' // Cron syntax for midnight every day
    },
    
    // Action configuration (invoke a contract)
    action: {
      type: 'contract',
      network: 'MainNet',
      scriptHash: '0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79',
      operation: 'updateDailyValue',
      args: [
        { type: 'Integer', value: new Date().getTime() }
      ]
    }
  });
  
  console.log('Automation created:', automation);
}

createAutomation().catch(console.error);`}</pre>
      </div>
      
      <h2>Setting Up Your Development Environment</h2>
      
      <div className="my-8">
        <h3>Installing the SDK</h3>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`# Using npm
npm install neo-service-layer-sdk

# Using yarn
yarn add neo-service-layer-sdk`}</pre>

        <h3 className="mt-6">Configure the SDK</h3>
        
        <p>
          Create a configuration file to store your API keys and settings:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// config.js
module.exports = {
  apiKey: process.env.NEO_SERVICE_LAYER_API_KEY || 'your-api-key-here',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
};

// app.js
const { NeoServiceLayer } = require('neo-service-layer-sdk');
const config = require('./config');

const serviceLayer = new NeoServiceLayer({
  apiKey: config.apiKey,
  environment: config.environment
});

// Now you can use serviceLayer in your application`}</pre>
      </div>
      
      <h2>Available Services</h2>
      
      <div className="my-8">
        <p>
          The Neo Service Layer provides several services to enhance your blockchain applications:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
          <Link 
            href="/docs/services/functions" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-xl font-bold mb-2">Functions Service</h3>
            <p className="text-gray-600 mb-2">
              Run serverless functions in a secure Trusted Execution Environment (TEE).
            </p>
            <div className="text-primary">Learn more →</div>
          </Link>
          
          <Link 
            href="/docs/services/secrets" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-xl font-bold mb-2">Secrets Management</h3>
            <p className="text-gray-600 mb-2">
              Securely store and manage sensitive data for your applications.
            </p>
            <div className="text-primary">Learn more →</div>
          </Link>
          
          <Link 
            href="/docs/services/automation" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-xl font-bold mb-2">Contract Automation</h3>
            <p className="text-gray-600 mb-2">
              Automate smart contract interactions based on time or events.
            </p>
            <div className="text-primary">Learn more →</div>
          </Link>
          
          <Link 
            href="/docs/services/price-feed" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-xl font-bold mb-2">Price Feed</h3>
            <p className="text-gray-600 mb-2">
              Get reliable token price updates for DeFi applications.
            </p>
            <div className="text-primary">Learn more →</div>
          </Link>
          
          <Link 
            href="/docs/services/gas-bank" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-xl font-bold mb-2">Gas Bank</h3>
            <p className="text-gray-600 mb-2">
              Manage GAS costs for your service operations efficiently.
            </p>
            <div className="text-primary">Learn more →</div>
          </Link>
          
          <Link 
            href="/docs/services/random" 
            className="block p-6 border rounded-lg hover:border-primary hover:shadow-md transition-all bg-white"
          >
            <h3 className="text-xl font-bold mb-2">Random Number Generation</h3>
            <p className="text-gray-600 mb-2">
              Generate secure, verifiable random numbers for your applications.
            </p>
            <div className="text-primary">Learn more →</div>
          </Link>
        </div>
      </div>
      
      <h2>Next Steps</h2>
      
      <div className="my-8 space-y-6">
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Architecture Overview</h3>
          <p className="mb-2">
            Learn about the architecture and security model of the Neo Service Layer.
          </p>
          <Link href="/docs/architecture" className="text-primary hover:underline">
            View Architecture →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Setting Up Your First Project</h3>
          <p className="mb-2">
            Follow a detailed tutorial on setting up and deploying your first project.
          </p>
          <Link href="/docs/tutorials/first-project" className="text-primary hover:underline">
            View Tutorial →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">API Reference</h3>
          <p className="mb-2">
            Browse the complete API documentation for all services.
          </p>
          <Link href="/docs/api" className="text-primary hover:underline">
            View API Documentation →
          </Link>
        </div>
      </div>
    </div>
  );
} 