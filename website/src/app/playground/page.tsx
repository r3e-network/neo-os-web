"use client";

import { useState, useRef } from 'react';
import Link from 'next/link';
import FunctionEditor from '@/components/playground/FunctionEditor';
import WalletExample from './WalletExample';
import { motion } from 'framer-motion';
import CodeBlock from '@/components/docs/CodeBlock';

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
  const editorRef = useRef<any>(null);
  
  // Reference to the FunctionEditor component
  const setEditorRef = (ref: any) => {
    editorRef.current = ref;
  };
  
  // Function to load an example into the editor
  const loadExampleToEditor = (exampleIndex: number) => {
    const example = examples[exampleIndex];
    if (editorRef.current && example) {
      console.log("Loading example:", example.name);
      // Ensure the editor is visible first
      setActiveTab('editor');
      
      // Use setTimeout to ensure the tab switch has completed
      setTimeout(() => {
        editorRef.current.loadExample(example.code, example.args);
      }, 100);
    } else {
      console.error("Failed to load example:", editorRef.current, example);
    }
  };
  
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
                className={`px-6 py-3 font-medium text-sm relative ${
                  activeTab === 'editor'
                    ? 'text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('editor')}
              >
                Function Editor
                {activeTab === 'editor' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm relative ${
                  activeTab === 'wallet'
                    ? 'text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('wallet')}
              >
                Wallet Connection
                {activeTab === 'wallet' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm relative ${
                  activeTab === 'examples'
                    ? 'text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('examples')}
              >
                Examples
                {activeTab === 'examples' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                className={`px-6 py-3 font-medium text-sm relative ${
                  activeTab === 'documentation'
                    ? 'text-primary'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => setActiveTab('documentation')}
              >
                Documentation
                {activeTab === 'documentation' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'editor' && (
                <div>
                  <p className="mb-6 text-gray-600">
                    Write and test your JavaScript functions in this playground. The execution is simulated, but it represents how your code would run in the actual TEE environment.
                  </p>
                  <FunctionEditor ref={setEditorRef} />
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
                      <motion.div 
                        key={index} 
                        className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        whileHover={{ y: -5 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        onClick={() => loadExampleToEditor(index)}
                      >
                        <div className="bg-gray-50 p-4 border-b">
                          <h3 className="font-bold text-lg">{example.name}</h3>
                          <p className="text-gray-600 text-sm">{example.description}</p>
                        </div>
                        <div className="p-0">
                          <CodeBlock 
                            language="javascript" 
                            code={example.code.substring(0, 150) + "..."} 
                            showLineNumbers={false}
                            className="m-0"
                          />
                        </div>
                        <div className="p-4 flex justify-end">
                          <button
                            className="px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary-dark transition-colors duration-200 flex items-center"
                            onClick={(e) => {
                              e.stopPropagation(); // Stop event propagation to prevent conflicts
                              loadExampleToEditor(index);
                            }}
                          >
                            <span>Try this example</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </motion.div>
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
                    
                    <CodeBlock
                      language="javascript"
                      code={`function main(args) {
  // Your code here
  
  return {
    result: "Your result"
  };
}`}
                      caption="Basic function structure"
                    />
                    
                    <h2>Security Limitations</h2>
                    <p>
                      For security reasons, functions are executed in a sandbox with the following limitations:
                    </p>
                    <ul>
                      <li>No access to the file system</li>
                      <li>No access to process information or environment variables (except those explicitly provided)</li>
                      <li>Limited memory usage (default: 128MB)</li>
                      <li>Execution timeout (default: 30 seconds)</li>
                      <li>Network access is restricted to allowed domains only</li>
                    </ul>
                    
                    <h2>Available APIs</h2>
                    
                    <h3>Neo N3 Blockchain API</h3>
                    <p>
                      The <code>neo</code> object provides methods to interact with the Neo N3 blockchain:
                    </p>
                    
                    <CodeBlock
                      language="javascript"
                      code={`// Get balance for an address
const neoBalance = neo.getBalance(address, 'NEO');

// Get recent transactions for an address
const transactions = neo.getTransactions(address, { limit: 5 });

// Get current block height
const blockHeight = neo.getBlockHeight();

// Get current price
const price = neo.getPrice('NEO/USD');

// Call a contract method (read-only)
const result = neo.call({
  scriptHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
  operation: "getTotalStaked",
  args: []
});

// Invoke a contract method (mutates state)
const tx = await neo.invokeContract({
  scriptHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
  operation: "stake",
  args: [
    { type: "Integer", value: "1000" }
  ],
  signers: [{ account: address, scopes: "CalledByEntry" }],
  useGasBank: true
});`}
                      filename="neo-api-examples.js"
                    />
                    
                    <h3>Secrets API</h3>
                    <p>
                      The <code>secrets</code> object allows you to access your securely stored secrets:
                    </p>
                    
                    <CodeBlock
                      language="javascript"
                      code={`// Get a stored API key
const apiKey = secrets.get('my_api_key');

// Use the API key in a request
const response = await fetch('https://api.example.com/data', {
  headers: {
    'Authorization': \`Bearer \${apiKey}\`
  }
});`}
                      filename="secrets-api-example.js"
                    />
                    
                    <h2>Learn More</h2>
                    <p>
                      For more detailed documentation on the Service Layer functions, visit:
                    </p>
                    <ul>
                      <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
                      <li><Link href="/docs/api/functions-api" className="text-primary hover:underline">Functions API Reference</Link></li>
                      <li><Link href="/docs/guides/functions-guide" className="text-primary hover:underline">Functions Development Guide</Link></li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}