"use client";

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';
import FeatureCard from '@/components/docs/FeatureCard';
import StepGuide from '@/components/docs/StepGuide';
import TabPanel from '@/components/docs/TabPanel';
import LiveExample from '@/components/docs/interactive/LiveExample';

export default function FunctionServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1 className="text-4xl font-bold mb-6 text-gradient bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Functions Service</h1>
      
      <Callout type="info" title="Overview">
        The Functions Service allows you to execute JavaScript functions in a secure Trusted Execution Environment (TEE).
        Your code runs in isolation with memory limits, timeout enforcement, and security protections, while still having
        access to blockchain data and external APIs.
      </Callout>
      
      <h2 className="mt-8">Key Features</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
        <FeatureCard 
          title="Secure Execution" 
          iconComponent={
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          }
        >
          <p>Run code within Azure Confidential Computing TEE for maximum security and data protection.</p>
        </FeatureCard>
        
        <FeatureCard 
          title="Resource Management" 
          iconComponent={
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        >
          <p>Memory limits, timeout enforcement, and VM-per-execution isolation for reliable operation.</p>
        </FeatureCard>
        
        <FeatureCard 
          title="Blockchain Access" 
          iconComponent={
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        >
          <p>Built-in Neo API for reading balances, fetching transactions, and interacting with contracts.</p>
        </FeatureCard>
        
        <FeatureCard 
          title="Secure Secrets" 
          iconComponent={
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          }
        >
          <p>Access securely stored API keys and credentials within your function via the secrets API.</p>
        </FeatureCard>
        
        <FeatureCard 
          title="External API Access" 
          iconComponent={
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
        >
          <p>Call external APIs securely using the standard fetch API while maintaining data privacy.</p>
        </FeatureCard>
        
        <FeatureCard 
          title="Security Sandbox" 
          iconComponent={
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        >
          <p>Frozen prototypes and strict mode enforcement to prevent prototype pollution and other attacks.</p>
        </FeatureCard>
      </div>
      
      <h2>Trusted Execution Environment (TEE)</h2>
      
      <p>
        The Service Layer utilizes Azure Confidential Computing to provide hardware-based TEE capabilities that ensure:
      </p>
      
      <ul>
        <li>Code and data are protected while in use</li>
        <li>Code execution is verifiable via attestation</li>
        <li>Secrets can be securely managed within the TEE</li>
      </ul>
      
      <p>
        We leverage Azure's DCsv3-series virtual machines featuring Intel SGX (Software Guard Extensions) technology.
      </p>
      
      <h3>TEE Architecture</h3>
      
      <CodeBlock
        language="text"
        code={`┌─────────────────────────────────────────────────────────────┐
│                          Host OS                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 TEE Container                        │    │
│  │                                                      │    │
│  │  ┌────────────────┐   ┌───────────────────────────┐ │    │
│  │  │                │   │                           │ │    │
│  │  │ JS Runtime     │   │ Secure Secret Storage     │ │    │
│  │  │                │   │                           │ │    │
│  │  └────────────────┘   └───────────────────────────┘ │    │
│  │                                                      │    │
│  │  ┌────────────────┐   ┌───────────────────────────┐ │    │
│  │  │                │   │                           │ │    │
│  │  │ Attestation    │   │ Secure Network Interface  │ │    │
│  │  │ Service        │   │                           │ │    │
│  │  └────────────────┘   └───────────────────────────┘ │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘`}
      />
      
      <h3>TEE Components</h3>
      
      <h4>1. TEE Container</h4>
      <p>
        A Docker container running in the SGX-enabled VM that provides the TEE environment. 
        The container is configured to leverage Intel SGX enclaves.
      </p>
      
      <h4>2. JavaScript Runtime</h4>
      <p>
        A secure JavaScript execution environment running within the TEE:
      </p>
      <ul>
        <li>V8 JavaScript engine with SGX support</li>
        <li>Sandboxed execution environment</li>
        <li>Limited standard library access</li>
        <li>Resource usage monitoring and limitations</li>
      </ul>
      
      <h4>3. Secure Secret Storage</h4>
      <p>
        A system for securely managing user secrets within the TEE:
      </p>
      <ul>
        <li>Secrets are encrypted at rest using keys only available in the TEE</li>
        <li>Secrets are only decrypted within the TEE memory during function execution</li>
        <li>Access control ensures only authorized functions can access specific secrets</li>
      </ul>
      
      <h4>4. Attestation Service</h4>
      <p>
        A service that provides cryptographic proof that:
      </p>
      <ul>
        <li>The TEE is genuine and running on trusted hardware</li>
        <li>The correct code is running within the TEE</li>
        <li>The TEE has not been tampered with</li>
      </ul>
      
      <h4>5. Secure Network Interface</h4>
      <p>
        A component that handles secure communication between:
      </p>
      <ul>
        <li>The TEE and external services</li>
        <li>The TEE and the Neo N3 blockchain</li>
        <li>The TEE and the rest of the service layer</li>
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
      
      <CodeBlock
        language="javascript"
        code={`function main(args) {
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
      />
      
      <h3>Execution Model</h3>
      
      <StepGuide
        steps={[
          {
            title: "Upload Function & Submit Request",
            content: (
              <div>
                <p>You upload a JavaScript function to the service and submit it for execution with arguments. 
                The source code and parameters are securely transferred to the TEE.</p>
                <div className="mt-2 ml-2 p-2 bg-gray-50 border-l-2 border-primary text-sm">
                  <code>serviceLayer.functions.invoke("myFunction", {`{"param1": "value1"}`})</code>
                </div>
              </div>
            )
          },
          {
            title: "Environment Setup",
            content: (
              <div>
                <p>The service loads your function code into a secure V8 isolate inside the TEE. A sandboxed
                execution environment is set up with global objects like <code>neo</code> and <code>secrets</code>.</p>
                <div className="flex items-center justify-center">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                </div>
              </div>
            )
          },
          {
            title: "Secrets and Permissions",
            content: (
              <div>
                <p>If your function uses secrets, they are securely accessed and decrypted within the TEE memory. 
                The environment verifies your function has the appropriate permissions to access these secrets.</p>
                <div className="flex justify-center mt-2">
                  <div className="p-2 bg-gray-50 border rounded-md text-xs max-w-xs overflow-x-auto">
                    <pre>{`// Access a secret within the TEE
const apiKey = secrets.get('my_api_key');`}</pre>
                  </div>
                </div>
              </div>
            )
          },
          {
            title: "Function Execution",
            content: (
              <div>
                <p>Your function executes in the isolated environment with access to the Neo blockchain API,
                secrets, and external resources via fetch. Memory and CPU usage are monitored and limited.</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div className="bg-primary h-2 rounded-full w-3/4"></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Memory: 75%</span>
                  <span>CPU: 42%</span>
                  <span>Time: 520ms</span>
                </div>
              </div>
            )
          },
          {
            title: "Result Processing",
            content: (
              <div>
                <p>The function result is serialized as JSON and returned to the caller. Any temporary data
                in memory is securely wiped, and execution resources are released.</p>
                <div className="bg-gray-900 rounded-md p-2 text-green-400 text-xs font-mono mt-2">
                  {`{
  "result": "Success",
  "data": { ... },
  "timestamp": "2023-08-15T12:34:56Z"
}`}
                </div>
              </div>
            )
          }
        ]}
      />
      
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
      
      <h3>Additional Security Measures</h3>
      
      <ol>
        <li>
          <strong>Memory Protection</strong>
          <ul>
            <li>All sensitive data within the TEE is protected from external access</li>
            <li>Memory is securely wiped after use</li>
          </ul>
        </li>
        <li>
          <strong>Side-Channel Protections</strong>
          <ul>
            <li>Implementation includes mitigations for known side-channel attacks</li>
            <li>Regular security updates for the TEE components</li>
          </ul>
        </li>
        <li>
          <strong>Network Security</strong>
          <ul>
            <li>All communication with the TEE uses TLS 1.3</li>
            <li>Certificate pinning for additional security</li>
          </ul>
        </li>
        <li>
          <strong>Code Integrity</strong>
          <ul>
            <li>Function code is validated before execution</li>
            <li>JavaScript runtime is patched against known vulnerabilities</li>
          </ul>
        </li>
        <li>
          <strong>Resource Limitations</strong>
          <ul>
            <li>Functions have strict memory and CPU limits</li>
            <li>Timeouts prevent infinite loops or resource exhaustion</li>
          </ul>
        </li>
      </ol>

      <Callout type="warning" title="Important Security Note">
        While the TEE provides strong security guarantees, it's still important to follow security best practices
        in your code. Don't include sensitive information directly in your function code, use the Secrets service instead.
      </Callout>
      
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
      
      <h3>JavaScript Runtime Security</h3>
      
      <p>The JavaScript runtime within the TEE is secured by:</p>
      
      <ol>
        <li>Removing unsafe APIs (e.g., <code>eval</code>, <code>Function</code> constructor)</li>
        <li>Limiting file system access</li>
        <li>Restricting network access to whitelisted endpoints</li>
        <li>Applying resource quotas (memory, CPU)</li>
        <li>Timing out long-running operations</li>
        <li>Sanitizing inputs and outputs</li>
      </ol>
      
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
      
      <h4>Neo N3 Blockchain API</h4>
      
      <p>The <code>neo</code> object provides methods to interact with the Neo N3 blockchain:</p>
      
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
      />
      
      <h4>Secret Usage in Functions</h4>
      
      <p>The <code>secrets</code> object provides access to securely stored sensitive data:</p>
      
      <CodeBlock
        language="javascript"
        code={`// Example function using secrets
function fetchPriceData(token) {
  // Access to secrets is provided via a secure API
  const apiKey = secrets.get('exchange_api_key');
  
  // Use the secret to make an authenticated request
  const response = fetch(\`https://api.exchange.com/prices/\${token}\`, {
    headers: {
      'Authorization': \`Bearer \${apiKey}\`
    }
  });
  
  return response.json();
}`}
      />
      
      <p>The <code>secrets.get()</code> API only retrieves secrets that have been explicitly allowed for the function, and the secret value is only accessible within the TEE.</p>
      
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
      
      <h3>Integration with Automation Service</h3>
      
      <p>You can set up automation triggers to execute your functions:</p>
      
      <h4>Cron Triggers</h4>
      
      <CodeBlock
        language="json"
        code={`{
  "trigger_type": "cron",
  "trigger_config": {
    "schedule": "0 0 * * *",  // Daily at midnight
    "timezone": "UTC"
  },
  "function_name": "dailyUpdate"
}`}
      />
      
      <h4>Price Triggers</h4>
      
      <CodeBlock
        language="json"
        code={`{
  "trigger_type": "price",
  "trigger_config": {
    "asset_pair": "NEO/USD",
    "condition": "above",
    "threshold": 50.0,
    "duration": 300  // Must be above threshold for 5 minutes
  },
  "function_name": "handlePriceAlert"
}`}
      />
      
      <h4>Blockchain Triggers</h4>
      
      <CodeBlock
        language="json"
        code={`{
  "trigger_type": "blockchain",
  "trigger_config": {
    "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
    "event_name": "Transfer"
  },
  "function_name": "processTransfer"
}`}
      />
      
      <h2>Monitoring and Metrics</h2>
      
      <p>The Functions Service provides monitoring for:</p>
      
      <ul>
        <li>Function execution counts and success rates</li>
        <li>Execution duration and resource usage</li>
        <li>Error rates and types</li>
        <li>TEE health and performance</li>
      </ul>
      
      <p>These metrics help you optimize your functions and detect potential issues.</p>
      
      <h2>Examples</h2>
      
      <LiveExample
        title="Basic Function Example"
        description="Try this simple function that returns a greeting message and timestamp. Edit the code or input and run it to see the results."
        code={`function main(args) {
  return {
    message: "Hello, " + (args.name || "World") + "!",
    timestamp: new Date().toISOString()
  };
}`}
        defaultInput={`{
  "name": "Neo"
}`}
      />
      
      <h3>Fetch External Data</h3>
      <CodeBlock
        language="javascript"
        code={`async function main(args) {
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
      />
      
      <LiveExample
        title="Blockchain Interaction Example"
        description="This function retrieves blockchain data for an address. Try providing different addresses or leave it blank to see the default behavior."
        code={`function main(args) {
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
        defaultInput={`{
  "address": "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv"
}`}
      />
      
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