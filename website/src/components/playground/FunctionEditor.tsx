"use client";

import { useState } from 'react';
import Editor from '@monaco-editor/react';

// Default function template
const DEFAULT_FUNCTION = `// Write your JavaScript function here
// The main function will be executed with the provided arguments
function main(args) {
  // Example: Access blockchain data
  // const balance = neo.getBalance(args.address);
  
  // Example: Make external API call
  // const response = await fetch('https://api.example.com/data');
  // const data = await response.json();
  
  // Return your result
  return {
    message: "Hello from Service Layer!",
    receivedArgs: args
  };
}`;

// Default arguments template
const DEFAULT_ARGS = `{
  "address": "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv",
  "value": 42,
  "data": {
    "example": true
  }
}`;

interface FunctionExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
}

export default function FunctionEditor() {
  const [code, setCode] = useState(DEFAULT_FUNCTION);
  const [args, setArgs] = useState(DEFAULT_ARGS);
  const [result, setResult] = useState<FunctionExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  const executeFunction = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // In a real implementation, this would call a Netlify function
      // For now, we'll simulate execution with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Parse the args
      const parsedArgs = JSON.parse(args);
      
      // Simulate successful execution
      setResult({
        success: true,
        data: {
          message: "Hello from Service Layer!",
          receivedArgs: parsedArgs
        },
        executionTime: 0.213
      });
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
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
                  <pre className="bg-white p-4 rounded border border-gray-200 overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div>
                  <div className="text-red-500 font-semibold mb-2">
                    ✗ Execution failed
                  </div>
                  <pre className="bg-white p-4 rounded border border-red-200 text-red-600 overflow-auto">
                    {result.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}