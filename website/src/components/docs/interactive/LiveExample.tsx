"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import CodeBlock from '@/components/docs/CodeBlock';

interface LiveExampleProps {
  title: string;
  description?: string;
  code: string;
  defaultInput?: string;
  language?: string;
  executeFunction?: (code: string, input: string) => Promise<any>;
}

export default function LiveExample({
  title,
  description,
  code,
  defaultInput = '{}',
  language = 'javascript',
  executeFunction
}: LiveExampleProps) {
  const [input, setInput] = useState(defaultInput);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [codeValue, setCodeValue] = useState(code);

  const execute = async () => {
    if (!executeFunction) {
      setError('Execution not available in this environment');
      return;
    }

    setIsRunning(true);
    setError('');
    try {
      const result = await executeFunction(codeValue, input);
      setOutput(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
    } catch (err: any) {
      setError(err.message || 'An error occurred during execution');
    } finally {
      setIsRunning(false);
    }
  };

  // Simulate execution in development environment
  const simulateExecution = async (code: string, input: string) => {
    // Wait a simulated processing time
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      // Create a safe evaluation environment
      const inputData = JSON.parse(input);
      
      // Simple mock environment with basic Neo functionality
      const mockNeo = {
        getBalance: (address: string, asset: string) => asset === 'NEO' ? 42 : 18.5743,
        getTransactions: () => [{txid: "0xabc...", type: "transfer", amount: 10}],
        getBlockHeight: () => 1847392,
        getPrice: (pair: string) => pair === 'NEO/USD' ? 11.42 : 0
      };

      // Mock secrets API
      const mockSecrets = {
        get: (key: string) => `[secure-${key}]`
      };

      // Create a function from the string but run it in a controlled context
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(
        'args', 'neo', 'secrets', 'console', 
        `try {
          ${code}
          if (typeof main === "function") {
            return await main(args);
          } else {
            return "No main function found";
          }
        } catch (e) {
          throw new Error("Execution error: " + e.message);
        }`
      );
      
      // Execute the function with mocked environment
      const logs: string[] = [];
      const mockConsole = {
        log: (...args: any[]) => {
          logs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '));
        }
      };
      
      const result = await fn(inputData, mockNeo, mockSecrets, mockConsole);
      
      // Return both the result and logs
      return {
        result,
        logs: logs.length > 0 ? logs : undefined
      };
    } catch (e: any) {
      throw new Error(`Error: ${e.message}`);
    }
  };

  useEffect(() => {
    // Set the executeFunction to the simulation if none is provided
    if (!executeFunction) {
      executeFunction = simulateExecution;
    }
  }, []);

  return (
    <div className="my-8 border rounded-lg overflow-hidden shadow-md bg-white">
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 border-b">
        <h3 className="text-xl font-semibold mb-1">{title}</h3>
        {description && <p className="text-gray-600 text-sm">{description}</p>}
      </div>
      
      <div className="p-4 bg-gray-50">
        <div className="mb-4">
          <CodeBlock
            language={language}
            code={codeValue}
            showLineNumbers={true}
            className="shadow-sm"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Input (JSON):
          </label>
          <textarea
            className="w-full h-24 p-2 border rounded-md font-mono text-sm bg-white"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        
        <div className="flex justify-end mb-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={execute}
            disabled={isRunning}
            className={`px-4 py-2 rounded-md text-white font-medium flex items-center ${
              isRunning ? 'bg-gray-400' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {isRunning ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run Example
              </>
            )}
          </motion.button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            <div className="font-medium">Error:</div>
            {error}
          </div>
        )}
        
        {output && (
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Output:
            </label>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm overflow-x-auto">
              <pre>{output}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}