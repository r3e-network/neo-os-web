'use client';

import Link from 'next/link';

export default function FirstFunctionGuidePage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Building Your First Function</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          This guide will walk you through the process of creating, deploying, and testing your first 
          Function on the Neo Service Layer. By the end of this guide, you'll have a working Function 
          that can be triggered via API and interacts with the Neo N3 blockchain.
        </p>
      </div>
      
      <h2>Prerequisites</h2>
      <p>Before getting started, ensure you have:</p>
      <ul>
        <li>A Neo Service Layer account with API keys</li>
        <li>A Neo N3 wallet with some GAS tokens</li>
        <li>Basic knowledge of JavaScript</li>
        <li>The Neo Service Layer SDK installed (optional for this guide)</li>
      </ul>
      
      <h2>Step 1: Create a Basic Function</h2>
      <p>
        Let's start by creating a simple Function that returns a greeting message. We'll build on 
        this foundation to add more features.
      </p>
      
      <h3>Function Code</h3>
      <p>
        Create a new JavaScript file named <code>hello.js</code> with the following content:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`function main(args) {
  // Get the name from the arguments or use "World" as default
  const name = args.name || "World";
  
  // Log something to the function execution logs
  console.log("Function executed with name:", name);
  
  // Return a simple greeting
  return {
    message: \`Hello, \${name}!\`,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <p>
        This function takes an optional <code>name</code> parameter and returns a greeting message
        along with the current timestamp.
      </p>
      
      <h3>Deploying the Function</h3>
      <p>
        You can deploy this function either through the web dashboard or using the API.
      </p>
      
      <h4>Option 1: Using the Web Dashboard</h4>
      <ol>
        <li>Log in to your Neo Service Layer account</li>
        <li>Navigate to the Functions section</li>
        <li>Click "Create New Function"</li>
        <li>Enter "HelloWorld" as the function name</li>
        <li>Paste the code from <code>hello.js</code> into the code editor</li>
        <li>
          In the Trigger section, select "API" as the trigger type and ensure "Authentication Required" 
          is checked
        </li>
        <li>Click "Save and Deploy"</li>
      </ol>
      
      <h4>Option 2: Using the API</h4>
      <p>
        You can also deploy the function programmatically:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`// Using the JavaScript SDK
import { NeoServiceLayer } from 'neo-service-layer-sdk';

const serviceLayer = new NeoServiceLayer({
  apiKey: 'YOUR_API_KEY',
  network: 'mainnet', // or 'testnet'
});

async function deployFunction() {
  const functionCode = \`function main(args) {
  // Get the name from the arguments or use "World" as default
  const name = args.name || "World";
  
  // Log something to the function execution logs
  console.log("Function executed with name:", name);
  
  // Return a simple greeting
  return {
    message: \`Hello, \${name}!\`,
    timestamp: new Date().toISOString()
  };
}\`;
  
  const config = {
    name: 'HelloWorld',
    trigger: {
      type: 'api',
      authRequired: true
    },
    timeout: 10000 // 10 seconds
  };
  
  try {
    const result = await serviceLayer.functions.deploy(functionCode, config);
    console.log('Function deployed successfully:', result.id);
    return result;
  } catch (error) {
    console.error('Deployment failed:', error);
  }
}

deployFunction();`}
      </pre>
    </div>
  );
}