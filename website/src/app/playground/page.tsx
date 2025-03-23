"use client";

import { useState } from 'react';
import Link from 'next/link';
import FunctionEditor from '@/components/playground/FunctionEditor';
import WalletExample from './WalletExample';

// Example templates
const examples = [
  {
    name: 'Hello World',
    description: 'Basic function that returns a greeting',
    code: `function main(args) {
  return {
    message: "Hello, " + (args.name || "World") + "!",
    timestamp: new Date().toISOString()
  };
}`,
    args: `{
  "name": "Neo"
}`
  },
  {
    name: 'Fetch External Data',
    description: 'Example of fetching data from an external API',
    code: `// This is a simulation - in the actual TEE, fetch would be available
async function main(args) {
  try {
    // Simulated fetch response
    return {
      cryptoPrice: {
        "neo": 11.42,
        "gas": 4.17,
        "bitcoin": 27650.80,
        "ethereum": 1670.25
      },
      timestamp: new Date().toISOString(),
      source: "CoinGecko API (simulated)"
    };
  } catch (error) {
    return { error: error.message };
  }
}`,
    args: `{
  "coin": "neo"
}`
  },
  {
    name: 'Blockchain Interaction',
    description: 'Example of reading blockchain data',
    code: `// This is a simulation - in the actual TEE, neo object would be available
function main(args) {
  // Simulate blockchain data retrieval
  const address = args.address || "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv";
  
  // Simulated data
  const balance = {
    NEO: 42,
    GAS: 18.5743
  };
  
  const transactions = [
    { txid: "0xf999c936a7a221bfdf8d57ac22f3db1aa04a19716cdb45a675c976ca19fcb27a", type: "transfer", amount: 10, timestamp: "2023-06-15T08:42:31Z" },
    { txid: "0xe8be48f490ca80b13873e3f0dd711af172e827c4d17a5bb88e7217d63f6a978e", type: "claim", amount: 1.2, timestamp: "2023-06-14T16:29:15Z" }
  ];
  
  return {
    address: address,
    balance: balance,
    recentTransactions: transactions,
    blockHeight: 1847392,
    timestamp: new Date().toISOString()
  };
}`,
    args: `{
  "address": "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv"
}`
  },
  {
    name: 'Using Secrets',
    description: 'Example of accessing stored secrets',
    code: `// This is a simulation - in the actual TEE, secrets would be available
function main(args) {
  // Simulate accessing a secret
  // In the real TEE, you would access secrets like this:
  // const apiKey = secrets.get('api_key');
  
  // For demo purposes, we'll pretend we got a secret
  const simulatedApiKey = "sk_test_**********";
  
  return {
    message: "Successfully accessed the API key secret",
    keyPreview: simulatedApiKey.substring(0, 8) + "************",
    secretsAvailable: ["api_key", "private_key", "webhook_secret"],
    timestamp: new Date().toISOString()
  };
}`,
    args: `{}`
  },
];

export default function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState('editor');
  
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-to-r from-secondary to-secondary/90 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="text-primary">Interactive</span> Playground
          </h1>
          <p className="text-lg md:text-xl mb-8 text-gray-200 max-w-3xl mx-auto">
            Experience the Neo N3 Service Layer firsthand. Write, test, and simulate JavaScript functions in our playground environment.
          </p>
        </div>
      </section>

      {/* Playground Section */}
      <section className="py-10">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            {/* Tabs Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                className={`px-6 py-3 font-medium text-sm ${
                  activeTab === 'editor'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('editor')}
              >
                Function Editor
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm ${
                  activeTab === 'wallet'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('wallet')}
              >
                Wallet Connection
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm ${
                  activeTab === 'examples'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('examples')}
              >
                Examples
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm ${
                  activeTab === 'documentation'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('documentation')}
              >
                Documentation
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'editor' && (
                <div>
                  <p className="mb-6 text-gray-600">
                    Write and test your JavaScript functions in this playground. The execution is simulated, but it represents how your code would run in the actual TEE environment.
                  </p>
                  <FunctionEditor />
                </div>
              )}

              {activeTab === 'wallet' && (
                <div>
                  <p className="mb-6 text-gray-600">
                    Connect your Neo N3 wallet to interact with the blockchain directly. This demonstrates the wallet integration capabilities of the Neo Service Layer.
                  </p>
                  <WalletExample />
                </div>
              )}

              {activeTab === 'examples' && (
                <div>
                  <p className="mb-6 text-gray-600">
                    Browse example functions to understand the capabilities of the Service Layer. Click on any example to load it into the editor.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {examples.map((example, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 p-4 border-b">
                          <h3 className="font-bold text-lg">{example.name}</h3>
                          <p className="text-gray-600 text-sm">{example.description}</p>
                        </div>
                        <div className="p-4 bg-gray-800 text-gray-200 text-sm overflow-x-auto">
                          <pre className="whitespace-pre-wrap">{example.code.substring(0, 150)}...</pre>
                        </div>
                        <div className="p-4 flex justify-end">
                          <button
                            className="px-4 py-2 bg-primary text-secondary rounded text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
                            onClick={() => {
                              // In a real implementation, this would load the example into the editor
                              setActiveTab('editor');
                            }}
                          >
                            Try this example
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'documentation' && (
                <div>
                  <p className="mb-6 text-gray-600">
                    Learn how to use the playground and understand the capabilities of the Neo N3 Service Layer functions.
                  </p>
                  
                  <div className="prose max-w-none">
                    <h2>Function Environment</h2>
                    <p>
                      In the real Service Layer, your JavaScript functions execute in a secure Trusted Execution Environment (TEE) powered by Azure Confidential Computing. Functions have access to:
                    </p>
                    <ul>
                      <li>Neo N3 blockchain data through the <code>neo</code> object</li>
                      <li>Your stored secrets through the <code>secrets</code> object</li>
                      <li>HTTP requests via the standard <code>fetch</code> API</li>
                      <li>Standard JavaScript functionality with some security limitations</li>
                    </ul>
                    
                    <h2>Function Structure</h2>
                    <p>
                      Your function must contain a <code>main</code> function that accepts an <code>args</code> parameter and returns a value. The value you return will be serialized as JSON and returned to the caller.
                    </p>
                    
                    <h2>Security Limitations</h2>
                    <p>
                      For security reasons, functions are executed in a sandbox with the following limitations:
                    </p>
                    <ul>
                      <li>No access to the file system</li>
                      <li>No access to process information or environment variables (except those explicitly provided)</li>
                      <li>Limited memory usage (default: 128MB)</li>
                      <li>Execution timeout (default: 30 seconds)</li>
                      <li>Network access is restricted to allowed domains</li>
                    </ul>
                    
                    <h2>Learn More</h2>
                    <p>
                      For more detailed information about the Functions service, please refer to our comprehensive documentation:
                    </p>
                    <ul>
                      <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
                      <li><Link href="/docs/guides/functions-guide" className="text-primary hover:underline">Functions Developer Guide</Link></li>
                      <li><Link href="/docs/api/functions-api" className="text-primary hover:underline">Functions API Reference</Link></li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to use Neo N3 Service Layer?
          </h2>
          <p className="text-lg mb-8 max-w-3xl mx-auto text-gray-600">
            When you're ready to deploy your functions to production, create an account to get started with the Neo N3 Service Layer.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact" className="btn btn-primary">
              Contact Us
            </Link>
            <Link href="/docs/getting-started" className="btn btn-outline">
              Read the Docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}