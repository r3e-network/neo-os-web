"use client";

import Link from 'next/link';
import Image from 'next/image';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function GettingStartedDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Getting Started with Neo Service Layer</h1>
      
      <Callout type="info" title="Overview">
        The Neo Service Layer provides a suite of services that enhance your Neo N3 blockchain applications.
        This guide will help you get started with setting up and using the Service Layer.
      </Callout>

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
            <div className="my-4 text-center">
              <Image 
                src="/images/docs/connect-wallet.png" 
                alt="Connect Wallet Interface" 
                width={500} 
                height={300}
                className="border rounded-lg shadow-md"
                style={{maxWidth: '100%', height: 'auto'}}
              />
              <p className="text-sm text-gray-500 mt-2">Connecting your Neo N3 wallet to the Service Layer</p>
            </div>
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
        
        <CodeBlock
          language="javascript"
          code={`// JavaScript example
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
.catch(error => console.error('Error:', error));`}
          filename="api-authentication.js"
        />

        <div className="mt-6">
          <p>
            Alternatively, use our SDK which handles authentication for you:
          </p>
          
          <CodeBlock
            language="javascript"
            code={`// Install the SDK
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
// etc.`}
            filename="sdk-initialization.js"
          />
        </div>
      </div>
      
      <h2>Quick Start Examples</h2>
      
      <div className="my-8">
        <h3>Example 1: Create and Deploy a Function</h3>
        
        <CodeBlock
          language="javascript"
          code={`// JavaScript example using the SDK
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

deployFunction().catch(console.error);`}
          filename="deploy-function-example.js"
        />
      </div>
      
      <div className="my-8">
        <h3>Example 2: Store and Retrieve a Secret</h3>
        
        <CodeBlock
          language="javascript"
          code={`// JavaScript example using the SDK
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

manageSecrets().catch(console.error);`}
          filename="secrets-example.js"
        />
      </div>
      
      <div className="my-8">
        <h3>Example 3: Set Up Contract Automation</h3>
        
        <CodeBlock
          language="javascript"
          code={`// JavaScript example using the SDK
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

createAutomation().catch(console.error);`}
          filename="automation-example.js"
        />
      </div>
      
      <h2>Next Steps</h2>
      
      <div className="my-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/docs/services/functions" 
          className="block p-6 border rounded-lg hover:shadow-md transition-shadow bg-gray-50 no-underline">
          <h3 className="text-xl font-semibold text-primary mb-2">Functions Service</h3>
          <p className="text-gray-600">Learn how to create, deploy, and invoke secure JavaScript functions in our TEE environment.</p>
        </Link>
        
        <Link href="/docs/services/secrets" 
          className="block p-6 border rounded-lg hover:shadow-md transition-shadow bg-gray-50 no-underline">
          <h3 className="text-xl font-semibold text-primary mb-2">Secrets Management</h3>
          <p className="text-gray-600">Store and manage sensitive data securely in our Trusted Execution Environment.</p>
        </Link>
        
        <Link href="/docs/services/automation" 
          className="block p-6 border rounded-lg hover:shadow-md transition-shadow bg-gray-50 no-underline">
          <h3 className="text-xl font-semibold text-primary mb-2">Contract Automation</h3>
          <p className="text-gray-600">Set up automated contract interactions triggered by time or events.</p>
        </Link>
        
        <Link href="/docs/services/gas-bank" 
          className="block p-6 border rounded-lg hover:shadow-md transition-shadow bg-gray-50 no-underline">
          <h3 className="text-xl font-semibold text-primary mb-2">Gas Bank</h3>
          <p className="text-gray-600">Learn how to use the Gas Bank service for optimizing transaction costs.</p>
        </Link>
      </div>
      
      <Callout type="tip" title="Need Help?">
        If you encounter any issues or have questions, please visit our <Link href="/docs/faq" className="text-primary hover:underline">FAQ</Link> or 
        <Link href="/contact" className="text-primary hover:underline"> contact our support team</Link>.
      </Callout>
    </div>
  );
} 