"use client";

import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

// Default function template
const DEFAULT_FUNCTION = `// Write your JavaScript function here
// The main function will be executed with the provided arguments
async function main(args) {
  // Example: Access blockchain data
  const neoBalance = neo.getBalance(args.address, 'NEO');
  const gasBalance = neo.getBalance(args.address, 'GAS');
  
  // Example: Make external API call (simulated)
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();
  
  // Return your result
  return {
    message: "Hello from Service Layer!",
    address: args.address,
    balances: {
      NEO: neoBalance,
      GAS: gasBalance
    },
    timestamp: new Date().toISOString(),
    externalData: data.sample
  };
}`;

// Default arguments template
const DEFAULT_ARGS = `{
  "address": "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv",
  "value": 42,
  "action": "query"
}`;

interface FunctionExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  logs?: string[];
}

// Create a mock Neo N3 blockchain API
const createMockNeoAPI = () => {
  // Sample blockchain data
  const mockBalances: Record<string, Record<string, number>> = {
    'NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv': {
      'NEO': 42.0,
      'GAS': 18.5743,
      'FLM': 1250.75
    },
    'NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr': {
      'NEO': 100.0,
      'GAS': 35.8921,
      'FLM': 5000.0
    }
  };

  const mockTransactions: Record<string, Array<{txid: string, type: string, amount: number, timestamp: string}>> = {
    'NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv': [
      { txid: "0xf999c936a7a221bfdf8d57ac22f3db1aa04a19716cdb45a675c976ca19fcb27a", type: "transfer", amount: 10, timestamp: "2023-06-15T08:42:31Z" },
      { txid: "0xe8be48f490ca80b13873e3f0dd711af172e827c4d17a5bb88e7217d63f6a978e", type: "claim", amount: 1.2, timestamp: "2023-06-14T16:29:15Z" }
    ]
  };

  const mockPrices: Record<string, number> = {
    'NEO/USD': 11.42,
    'GAS/USD': 4.17,
    'BTC/USD': 27650.80,
    'ETH/USD': 1670.25,
    'NEO/BTC': 0.00041,
    'NEO/ETH': 0.00683
  };

  return {
    getBalance: (address: string, assetType: string) => {
      const addressBalances = mockBalances[address] || {};
      return addressBalances[assetType] || 0;
    },
    getTransactions: (address: string, options: {limit?: number} = {}) => {
      const limit = options.limit || 10;
      const txs = mockTransactions[address] || [];
      return txs.slice(0, limit);
    },
    getBlockHeight: () => 1847392,
    getPrice: (pairName: string) => mockPrices[pairName] || 0,
    getPrices: async (pairNames: string[]) => {
      const result: Record<string, number> = {};
      pairNames.forEach(pair => {
        result[pair] = mockPrices[pair] || 0;
      });
      return result;
    },
    getHistoricalPrice: ({ pair, timestamp }: {pair: string, timestamp: number}) => {
      // Simulate historical prices with a small variance
      const currentPrice = mockPrices[pair] || 0;
      const variance = 0.05; // 5% variance
      const randomFactor = 1 + (Math.random() * variance * 2 - variance);
      return currentPrice * randomFactor;
    },
    call: ({ 
      scriptHash, 
      operation, 
      args 
    }: { 
      scriptHash: string; 
      operation: string; 
      args: any[] 
    }) => {
      // Simulate smart contract calls
      if (scriptHash === "0xd2a4cff31913016155e38e474a2c06d08be276cf") {
        if (operation === "getTotalStaked") {
          return 100000;
        } else if (operation === "getStakers") {
          return [
            { address: "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv", amount: 1000 },
            { address: "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr", amount: 5000 }
          ];
        }
      } else if (scriptHash === "0x8c34578c30b7e1d148c6c5f2ddb75c812e6f1991") {
        if (operation === "getLoan") {
          return {
            collateralAmount: 10,
            loanAmount: 50,
            loanValueUSD: 50
          };
        }
      }
      
      return null;
    },
    invokeContract: async ({ 
      scriptHash, 
      operation, 
      args, 
      signers, 
      useGasBank 
    }: { 
      scriptHash: string; 
      operation: string; 
      args: any[]; 
      signers: any[]; 
      useGasBank?: boolean 
    }) => {
      // Simulate contract invocation
      return {
        txid: "0x" + Math.random().toString(16).substring(2, 34),
        gasConsumed: (Math.random() * 10).toFixed(8),
        stack: [{ type: "Integer", value: Math.floor(Math.random() * 1000).toString() }]
      };
    }
  };
};

// Create a mock secrets API
const createMockSecretsAPI = () => {
  const mockSecrets: Record<string, any> = {
    'my_api_key': 'sk_test_12345678901234567890',
    'database_credentials': {
      host: 'db.example.com',
      username: 'db_user',
      password: 'password123',
      database: 'app_db'
    },
    'weather_api_key': 'abcdef1234567890',
    'webhook_secret': 'whsec_87654321'
  };

  return {
    get: (secretName: string) => {
      return mockSecrets[secretName] || null;
    }
  };
};

// Mock fetch for the sandbox environment
const createMockFetch = (logs: string[]) => {
  return async (url: string, options: Record<string, any> = {}) => {
    logs.push(`Fetch request to: ${url}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock responses for different endpoints
    if (url.includes('api.example.com')) {
      return {
        ok: true,
        json: async () => ({ 
          sample: "This is sample data from a simulated API call",
          timestamp: new Date().toISOString()
        })
      };
    }
    
    if (url.includes('api.coingecko.com')) {
      return {
        ok: true,
        json: async () => ({
          neo: { usd: 11.42 },
          gas: { usd: 4.17 }
        })
      };
    }
    
    if (url.includes('api.weatherservice.com')) {
      return {
        ok: true,
        json: async () => ({
          location: url.includes('location=') ? url.split('location=')[1].split('&')[0] : 'New York',
          temperature: 72.5,
          conditions: 'Partly Cloudy',
          forecast: ['Sunny', 'Cloudy', 'Rain', 'Sunny', 'Sunny']
        })
      };
    }
    
    // Default response for unknown endpoints
    return {
      ok: true,
      json: async () => ({ message: "Mock response for: " + url })
    };
  };
};

// Create storage API
const createMockStorageAPI = () => {
  const store = new Map<string, any>();
  
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: any) => store.set(key, value),
    remove: (key: string) => store.delete(key),
    clear: () => store.clear()
  };
};

export default function FunctionEditor() {
  const [code, setCode] = useState(DEFAULT_FUNCTION);
  const [args, setArgs] = useState(DEFAULT_ARGS);
  const [result, setResult] = useState<FunctionExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Load example function/args from localStorage if available
  useEffect(() => {
    const savedCode = localStorage.getItem('playground-code');
    const savedArgs = localStorage.getItem('playground-args');
    
    if (savedCode) setCode(savedCode);
    if (savedArgs) setArgs(savedArgs);
  }, []);
  
  // Save code/args to localStorage when changed
  useEffect(() => {
    localStorage.setItem('playground-code', code);
    localStorage.setItem('playground-args', args);
  }, [code, args]);
  
  const executeFunction = async () => {
    setLoading(true);
    setResult(null);
    
    const logs: string[] = [];
    const consoleLog = (...args: any[]) => {
      logs.push(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '));
    };
    
    try {
      // Parse the args
      const parsedArgs = JSON.parse(args);
      
      // Create sandbox environment
      const neo = createMockNeoAPI();
      const secrets = createMockSecretsAPI();
      const storage = createMockStorageAPI();
      const fetch = createMockFetch(logs);
      
      // Prepare the function to execute
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      
      // Start timing
      const startTime = performance.now();
      
      // Execute the function in a safe context
      const sandbox = new AsyncFunction(
        'args', 'neo', 'secrets', 'storage', 'fetch', 'console',
        `
          "use strict";
          // Wrap execution to catch any errors
          try {
            ${code}
            return await main(args);
          } catch (error) {
            throw new Error(error.message || "Unknown error");
          }
        `
      );
      
      const data = await sandbox(
        parsedArgs, 
        neo, 
        secrets, 
        storage, 
        fetch,
        { log: consoleLog }
      );
      
      // End timing
      const endTime = performance.now();
      const executionTime = ((endTime - startTime) / 1000).toFixed(3);
      
      setResult({
        success: true,
        data,
        executionTime: parseFloat(executionTime),
        logs
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Function to load an example
  const loadExample = (exampleCode: string, exampleArgs: string) => {
    setCode(exampleCode);
    setArgs(exampleArgs);
  };
  
  return (
    <div className="playground-container border rounded-lg overflow-hidden bg-white shadow-md">
      <div className="flex flex-col md:flex-row">
        {/* Function Editor */}
        <div className="md:w-1/2 border-b md:border-b-0 md:border-r border-gray-200">
          <div className="p-4 bg-secondary text-white font-semibold">
            <h3>Function Code</h3>
          </div>
          <div className="h-[400px]">
            <Editor
              height="100%"
              language="javascript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
        
        {/* Arguments & Results */}
        <div className="md:w-1/2 flex flex-col">
          {/* Arguments Editor */}
          <div>
            <div className="p-4 bg-secondary text-white font-semibold">
              <h3>Arguments (JSON)</h3>
            </div>
            <div className="h-[200px]">
              <Editor
                height="100%"
                language="json"
                theme="vs-dark"
                value={args}
                onChange={(value) => setArgs(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
          
          {/* Results Section */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-t border-gray-200 bg-secondary text-white font-semibold flex justify-between items-center">
              <h3>Result</h3>
              <button 
                className={`px-4 py-2 rounded text-sm font-semibold transition-colors duration-200 ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-primary text-secondary hover:bg-primary/90'
                }`}
                onClick={executeFunction}
                disabled={loading}
              >
                {loading ? 'Executing...' : 'Execute Function'}
              </button>
            </div>
            <div className="flex-1 p-4 bg-gray-100 overflow-auto">
              {result === null ? (
                <div className="text-gray-500 italic">
                  Click "Execute Function" to see the result
                </div>
              ) : result.success ? (
                <div>
                  <div className="text-green-500 font-semibold mb-2">
                    ✓ Execution successful ({result.executionTime}s)
                  </div>
                  
                  {/* Console logs */}
                  {result.logs && result.logs.length > 0 && (
                    <div className="mb-4">
                      <div className="font-semibold text-gray-700 mb-1">Console output:</div>
                      <div className="bg-gray-800 text-gray-200 p-3 rounded font-mono text-sm overflow-auto max-h-[100px]">
                        {result.logs.map((log, i) => (
                          <div key={i}>&gt; {log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Result data */}
                  <div className="font-semibold text-gray-700 mb-1">Return value:</div>
                  <pre className="bg-white p-4 rounded border border-gray-200 overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div>
                  <div className="text-red-500 font-semibold mb-2">
                    ✗ Execution failed
                  </div>
                  
                  {/* Console logs for errors too */}
                  {result.logs && result.logs.length > 0 && (
                    <div className="mb-4">
                      <div className="font-semibold text-gray-700 mb-1">Console output:</div>
                      <div className="bg-gray-800 text-gray-200 p-3 rounded font-mono text-sm overflow-auto max-h-[100px]">
                        {result.logs.map((log, i) => (
                          <div key={i}>&gt; {log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <pre className="bg-white p-4 rounded border border-red-200 text-red-600 overflow-auto">
                    {result.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Example buttons */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-2">
          <div className="text-gray-600 font-medium mr-2">Examples:</div>
          <button 
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
            onClick={() => loadExample(
              `async function main(args) {
  // Get current NEO price
  const neoPrice = neo.getPrice("NEO/USD");
  
  // Get historical NEO price (simulated)
  const historicalPrice = neo.getHistoricalPrice({
    pair: "NEO/USD",
    timestamp: new Date("2023-03-15").getTime() / 1000
  });
  
  // Get multiple prices at once
  const prices = await neo.getPrices(["NEO/USD", "GAS/USD", "BTC/USD"]);
  
  return {
    currentNeoPrice: neoPrice,
    historicalNeoPrice: historicalPrice,
    allPrices: prices,
    timestamp: new Date().toISOString()
  };
}`,
              `{}`
            )}
          >
            Price Feed
          </button>
          
          <button 
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
            onClick={() => loadExample(
              `function main(args) {
  // Get the address from args or use a default
  const address = args.address || "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv";
  
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
}`,
              `{
  "address": "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv"
}`
            )}
          >
            Blockchain Query
          </button>
          
          <button 
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
            onClick={() => loadExample(
              `async function main(args) {
  // Get API key from secrets
  const apiKey = secrets.get('weather_api_key');
  
  // Call weather API for the requested location
  const location = args.location || 'New York';
  const response = await fetch(
    \`https://api.weatherservice.com/data?location=\${location}\`,
    { headers: { 'X-API-Key': apiKey } }
  );
  
  if (!response.ok) {
    throw new Error('Weather API request failed');
  }
  
  const weatherData = await response.json();
  
  console.log("Weather data received:", weatherData);
  
  return {
    location: location,
    temperature: weatherData.temperature,
    conditions: weatherData.conditions,
    forecast: weatherData.forecast,
    timestamp: new Date().toISOString()
  };
}`,
              `{
  "location": "San Francisco"
}`
            )}
          >
            External API
          </button>
          
          <button 
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
            onClick={() => loadExample(
              `async function main(args) {
  const { address, loanId, warningThreshold, actionThreshold } = args;
  
  // Get loan details (simulated contract call)
  const loanContract = "0x8c34578c30b7e1d148c6c5f2ddb75c812e6f1991";
  const loan = neo.call({
    scriptHash: loanContract,
    operation: "getLoan",
    args: [loanId]
  });
  
  console.log("Loan details:", loan);
  
  // Get current NEO price
  const neoPrice = neo.getPrice("NEO/USD");
  
  // Calculate current collateral ratio
  const collateralValueUSD = loan.collateralAmount * neoPrice;
  const loanValueUSD = loan.loanAmount;
  const collateralRatio = collateralValueUSD / loanValueUSD;
  
  console.log(\`Collateral ratio: \${collateralRatio}\`);
  
  // Determine if action is needed
  let actionTaken = false;
  let actionType = null;
  
  if (collateralRatio <= actionThreshold) {
    actionType = "protective_action";
    actionTaken = true;
  } else if (collateralRatio <= warningThreshold) {
    actionType = "warning";
    actionTaken = true;
  }
  
  return {
    address,
    loanId,
    currentPrice: neoPrice,
    collateralAmount: loan.collateralAmount,
    loanAmount: loan.loanValueUSD,
    collateralRatio,
    warningThreshold,
    actionThreshold,
    actionTaken,
    actionType,
    timestamp: new Date().toISOString()
  };
}`,
              `{
  "address": "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv",
  "loanId": "loan123",
  "warningThreshold": 0.25,
  "actionThreshold": 0.15
}`
            )}
          >
            Complex Example
          </button>
        </div>
      </div>
    </div>
  );
}