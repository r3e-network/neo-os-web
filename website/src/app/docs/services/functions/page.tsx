"use client";

import Link from 'next/link';

export default function FunctionServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Functions Service</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Functions Service allows you to execute JavaScript functions in a secure Trusted Execution Environment (TEE).
          Your code runs in isolation with memory limits, timeout enforcement, and security protections, while still having
          access to blockchain data and external APIs.
        </p>
      </div>
      
      <h2>Key Features</h2>
      <ul>
        <li>Secure execution in Azure Confidential Computing TEE</li>
        <li>Memory limits and timeout enforcement</li>
        <li>Isolation with VM-per-execution model</li>
        <li>Sandbox security with frozen prototypes and strict mode</li>
        <li>Access to blockchain data via the <code>neo</code> object</li>
        <li>Access to your stored secrets via the <code>secrets</code> object</li>
        <li>External API access via the standard <code>fetch</code> API</li>
      </ul>
      
      <h2>Creating and Managing Functions</h2>
      <p>
        You can create, update, and delete functions through the API or web dashboard. Each function has:
      </p>
      <ul>
        <li>A unique name for identification</li>
        <li>JavaScript source code</li>
        <li>Optional configuration (memory limit, timeout, permissions)</li>
        <li>Execution history and logs</li>
      </ul>
      
      <h3>Function Structure</h3>
      <p>
        Your function must contain a <code>main</code> function that takes an <code>args</code> parameter and returns a value:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`function main(args) {
  // Your code here
  
  // You can access Neo N3 blockchain data
  const balance = neo.getBalance(args.address, 'NEO');
  
  // You can access your stored secrets
  const apiKey = secrets.get('my_api_key');
  
  // You can make external API calls
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();
  
  // Return a value (will be serialized as JSON)
  return {
    result: data,
    balance: balance,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h3>Execution Model</h3>
      <p>
        When you invoke a function, the Service Layer:
      </p>
      <ol>
        <li>Loads your function code into a secure V8 isolate inside the TEE</li>
        <li>Sets up the execution environment with the appropriate global objects</li>
        <li>Injects your secrets if they're used by the function</li>
        <li>Executes the function with the provided arguments</li>
        <li>Returns the result as a JSON-serialized response</li>
        <li>Cleans up the execution environment</li>
      </ol>
      
      <h2>Security Considerations</h2>
      <p>
        Functions are executed in a secure sandbox with several security measures:
      </p>
      <ul>
        <li>
          <strong>Memory Limiting:</strong> Each function has a memory limit (default: 128MB) to prevent
          resource exhaustion attacks.
        </li>
        <li>
          <strong>Timeout Enforcement:</strong> Functions have a maximum execution time (default: 30 seconds)
          to prevent infinite loops.
        </li>
        <li>
          <strong>VM Isolation:</strong> Each function execution gets its own VM isolate to prevent
          cross-function interference.
        </li>
        <li>
          <strong>Frozen Prototypes:</strong> JavaScript prototypes are frozen to prevent prototype pollution attacks.
        </li>
        <li>
          <strong>Network Access Control:</strong> Network access is restricted to allowed domains and rate limited.
        </li>
      </ul>
      
      <div className="bg-yellow-50 p-6 rounded-lg my-8 border-l-4 border-yellow-400">
        <h3 className="text-xl font-semibold text-yellow-800 mt-0">Important Security Note</h3>
        <p className="mb-0">
          While the TEE provides strong security guarantees, it's still important to follow security best practices
          in your code. Don't include sensitive information directly in your function code, use the Secrets service instead.
        </p>
      </div>
      
      <h2>JavaScript Runtime Environment</h2>
      <p>
        The Functions Service provides a modern JavaScript runtime with:
      </p>
      <ul>
        <li>ECMAScript 2020 support</li>
        <li>Async/await and Promises</li>
        <li>Standard built-in objects (Array, Object, Date, Math, etc.)</li>
        <li>JSON parse and stringify</li>
        <li>Console logging (redirected to function logs)</li>
        <li>Fetch API for HTTP requests</li>
        <li>TextEncoder/TextDecoder for working with binary data</li>
      </ul>
      
      <h3>Service-Specific Objects</h3>
      <p>
        The following objects are available in the global scope:
      </p>
      <ul>
        <li>
          <code>neo</code>: Object for interacting with the Neo N3 blockchain 
          (read balances, fetch transactions, etc.)
        </li>
        <li>
          <code>secrets</code>: Object for accessing your stored secrets 
          (API keys, private credentials, etc.)
        </li>
        <li>
          <code>storage</code>: Object for persisting small amounts of data between function executions
        </li>
      </ul>
      
      <h2>Using Functions with Other Services</h2>
      <p>
        Functions can be combined with other Service Layer features:
      </p>
      <ul>
        <li>
          <strong>Automation Service:</strong> Schedule functions to run on a time-based schedule or in response to blockchain events
        </li>
        <li>
          <strong>Secrets Service:</strong> Store sensitive data securely and access it from your functions
        </li>
        <li>
          <strong>Oracle Service:</strong> Create custom oracles that fetch, process, and publish data to the blockchain
        </li>
      </ul>
      
      <h2>Examples</h2>
      <h3>Basic Function</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`function main(args) {
  return {
    message: "Hello, " + (args.name || "World") + "!",
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h3>Fetch External Data</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`async function main(args) {
  try {
    // Get API key from secrets
    const apiKey = secrets.get('coingecko_api_key');
    
    // Fetch crypto price data
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=neo&vs_currencies=usd',
      { headers: { 'X-CoinGecko-Api-Key': apiKey } }
    );
    
    if (!response.ok) {
      throw new Error('API request failed: ' + response.status);
    }
    
    const data = await response.json();
    
    return {
      neo_price_usd: data.neo.usd,
      timestamp: new Date().toISOString(),
      source: "CoinGecko API"
    };
  } catch (error) {
    return { error: error.message };
  }
}`}
      </pre>
      
      <h3>Blockchain Interaction</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`function main(args) {
  const address = args.address;
  
  if (!address) {
    return { error: "Address is required" };
  }
  
  // Get NEO and GAS balances
  const neoBalance = neo.getBalance(address, 'NEO');
  const gasBalance = neo.getBalance(address, 'GAS');
  
  // Get recent transactions
  const transactions = neo.getTransactions(address, { limit: 5 });
  
  return {
    address: address,
    balances: {
      NEO: neoBalance,
      GAS: gasBalance
    },
    recentTransactions: transactions,
    blockHeight: neo.getBlockHeight(),
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h2>API Reference</h2>
      <p>
        For a complete API reference, see the <Link href="/docs/api/functions-api" className="text-primary hover:underline">Functions API documentation</Link>.
      </p>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/guides/functions-guide" className="text-primary hover:underline">Functions Developer Guide</Link></li>
        <li><Link href="/docs/services/secrets" className="text-primary hover:underline">Secrets Service Documentation</Link></li>
        <li><Link href="/docs/services/automation" className="text-primary hover:underline">Automation Service Documentation</Link></li>
        <li><Link href="/playground" className="text-primary hover:underline">Try the Functions Playground</Link></li>
      </ul>
    </div>
  );
}