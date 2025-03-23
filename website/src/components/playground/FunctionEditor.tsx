"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';

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

// Create the function editor component with ref forwarding
const FunctionEditor = forwardRef((props, ref) => {
  const [code, setCode] = useState(DEFAULT_FUNCTION);
  const [args, setArgs] = useState(DEFAULT_ARGS);
  const [result, setResult] = useState<FunctionExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [showFullResult, setShowFullResult] = useState(false);
  
  // Load example function/args from localStorage if available
  useEffect(() => {
    const savedCode = localStorage.getItem('playground-code');
    const savedArgs = localStorage.getItem('playground-args');
    
    if (savedCode) setCode(savedCode);
    if (savedArgs) setArgs(savedArgs);
  }, []);
  
  // Save code/args to localStorage when they change
  useEffect(() => {
    localStorage.setItem('playground-code', code);
    localStorage.setItem('playground-args', args);
  }, [code, args]);
  
  // Execute the function in a sandbox environment
  const executeFunction = async () => {
    setLoading(true);
    setResult(null);
    
    const logs: string[] = [];
    
    // Create a mock console.log for the sandbox
    const consoleLog = (...args: any[]) => {
      const logString = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      logs.push(logString);
    };
    
    try {
      // Parse the arguments
      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(args);
      } catch (e: any) {
        throw new Error(`Invalid arguments JSON: ${e.message}`);
      }
      
      // Create the sandbox environment
      const neo = createMockNeoAPI();
      const secrets = createMockSecretsAPI();
      const fetch = createMockFetch(logs);
      const storage = createMockStorageAPI();
      
      // Set up the execution context
      const sandbox = {
        args: parsedArgs,
        neo,
        secrets,
        fetch,
        storage,
        console: {
          log: consoleLog,
          error: consoleLog,
          warn: consoleLog,
          info: consoleLog
        }
      };
      
      // Wrap the code in an async function
      const wrappedCode = `
        return (async function() {
          ${code}
          return await main(args);
        })();
      `;
      
      // Measure execution time
      const startTime = performance.now();
      
      // Execute the function
      const functionFn = new Function(...Object.keys(sandbox), wrappedCode);
      const data = await functionFn(...Object.values(sandbox));
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Return the result
      setResult({
        success: true,
        data,
        executionTime,
        logs
      });
    } catch (error: any) {
      console.error('Function execution error:', error);
      
      setResult({
        success: false,
        error: error.message,
        logs
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Expose the loadExample method via ref
  useImperativeHandle(ref, () => ({
    loadExample: (exampleCode: string, exampleArgs: string) => {
      console.log("loadExample called in FunctionEditor with code length:", exampleCode.length);
      
      if (!exampleCode || !exampleArgs) {
        console.error("Invalid example code or args:", { exampleCode, exampleArgs });
        return;
      }
      
      try {
        // Set values with a slight delay to ensure UI is ready
        setTimeout(() => {
          // First, set the code and args
          setCode(exampleCode);
          setArgs(exampleArgs);
          
          // Reset any previous results when loading a new example
          setResult(null);
          
          // Save to localStorage for persistence
          localStorage.setItem('playground-code', exampleCode);
          localStorage.setItem('playground-args', exampleArgs);
          
          // Alert user that example was loaded
          const messageContainer = document.createElement('div');
          messageContainer.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
          messageContainer.textContent = 'Example loaded successfully';
          document.body.appendChild(messageContainer);
          
          setTimeout(() => {
            messageContainer.style.opacity = '0';
            messageContainer.style.transition = 'opacity 0.5s ease-out';
            setTimeout(() => {
              if (document.body.contains(messageContainer)) {
                document.body.removeChild(messageContainer);
              }
            }, 500);
          }, 2000);
          
          console.log("Example successfully loaded");
        }, 100);
      } catch (error) {
        console.error("Error loading example:", error);
      }
    }
  }));
  
  // Format JSON output
  const formatOutput = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  };
  
  // Get a preview of the result for the collapsed view
  const getResultPreview = (data: any) => {
    const json = formatOutput(data);
    if (json.length <= 300) return json;
    return json.substring(0, 300) + '...';
  };
  
  return (
    <div className="space-y-6">
      {/* Function Editor */}
      <div className="border rounded-lg overflow-hidden shadow-md">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-100 border-b">
          <h3 className="font-medium">Function</h3>
          <div className="flex items-center space-x-2">
            <select 
              className="text-sm border-gray-300 rounded-md focus:border-blue-500 focus:ring-blue-500"
              value={editorTheme}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditorTheme(e.target.value)}
            >
              <option value="vs-dark">Dark Theme</option>
              <option value="vs-light">Light Theme</option>
            </select>
          </div>
        </div>
        <div className="h-[400px]">
          <Editor
            height="100%"
            language="javascript"
            theme={editorTheme}
            value={code}
            onChange={(value) => value !== undefined && setCode(value)}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
              wordWrap: 'on',
              tabSize: 2,
              renderWhitespace: 'boundary',
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
              },
              padding: { top: 10 },
            }}
          />
        </div>
      </div>
      
      {/* Arguments Editor */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-100 border-b">
          <h3 className="font-medium">Arguments (JSON)</h3>
        </div>
        <div className="h-[150px]">
          <Editor
            height="100%"
            language="json"
            theme={editorTheme}
            value={args}
            onChange={(value) => value !== undefined && setArgs(value)}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
              fontSize: 14,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>
      </div>
      
      {/* Execute Button */}
      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`px-6 py-3 rounded-lg text-white ${loading ? 'bg-gray-500' : 'bg-primary hover:bg-primary/90'} font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors flex items-center space-x-2`}
          onClick={executeFunction}
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Executing...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Execute Function</span>
            </>
          )}
        </motion.button>
      </div>
      
      {/* Result Display */}
      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`border rounded-lg overflow-hidden ${result.success ? 'border-green-300' : 'border-red-300'}`}
        >
          <div className={`px-4 py-2 ${result.success ? 'bg-green-50 border-b border-green-200' : 'bg-red-50 border-b border-red-200'} flex justify-between items-center`}>
            <h3 className={`font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.success ? 'Result' : 'Error'}
              {result.executionTime && <span className="text-xs font-normal ml-2 text-gray-500">(executed in {result.executionTime.toFixed(2)}ms)</span>}
            </h3>
            <button 
              className="text-gray-500 hover:text-gray-700 focus:outline-none text-sm flex items-center"
              onClick={() => setShowFullResult(!showFullResult)}
            >
              {showFullResult ? 'Collapse' : 'Expand'}
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transition-transform ${showFullResult ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="bg-gray-900 p-4 text-gray-200 font-mono text-sm overflow-x-auto">
            <pre>{result.success 
              ? (showFullResult ? formatOutput(result.data) : getResultPreview(result.data))
              : result.error
            }</pre>
          </div>
        </motion.div>
      )}
      
      {/* Logs Display */}
      {result && result.logs && result.logs.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border rounded-lg overflow-hidden"
        >
          <div className="px-4 py-2 bg-gray-100 border-b flex justify-between items-center">
            <h3 className="font-medium">Console Logs</h3>
          </div>
          <div className="bg-gray-900 p-4 text-gray-300 font-mono text-sm max-h-[200px] overflow-y-auto">
            {result.logs.map((log, index) => (
              <div key={index} className="pb-1">
                <span className="text-gray-500 mr-2">{`>`}</span>
                {log}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
});

// Set display name for debugging
FunctionEditor.displayName = 'FunctionEditor';

export default FunctionEditor;