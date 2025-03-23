"use client";

import { useState } from 'react';
import CodeBlock from '@/components/docs/CodeBlock';
import { motion, AnimatePresence } from 'framer-motion';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiEndpointProps {
  method: HttpMethod;
  path: string;
  description: string;
  requestExample?: string;
  responseExample?: string;
}

export default function ApiEndpoint({
  method,
  path,
  description,
  requestExample,
  responseExample
}: ApiEndpointProps) {
  const [activeTab, setActiveTab] = useState<'request' | 'response'>(requestExample ? 'request' : 'response');

  const methodColors = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-green-100 text-green-700',
    PUT: 'bg-yellow-100 text-yellow-700',
    DELETE: 'bg-red-100 text-red-700',
    PATCH: 'bg-purple-100 text-purple-700'
  };

  return (
    <div className="my-6 border rounded-lg overflow-hidden shadow-sm">
      <div className="bg-gray-50 p-4 border-b flex items-start">
        <div className={`${methodColors[method]} px-3 py-1 rounded-md font-mono text-sm font-bold mr-3`}>
          {method}
        </div>
        <div className="flex-grow">
          <div className="font-mono text-md">{path}</div>
          <div className="text-sm text-gray-600 mt-1">{description}</div>
        </div>
      </div>
      
      {(requestExample || responseExample) && (
        <>
          <div className="border-b flex">
            {requestExample && (
              <button
                onClick={() => setActiveTab('request')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'request'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Request
              </button>
            )}
            {responseExample && (
              <button
                onClick={() => setActiveTab('response')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'response'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Response
              </button>
            )}
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'request' && requestExample && (
                <CodeBlock
                  language="json"
                  code={requestExample}
                  showLineNumbers={true}
                  className="rounded-t-none"
                />
              )}
              {activeTab === 'response' && responseExample && (
                <CodeBlock
                  language="json"
                  code={responseExample}
                  showLineNumbers={true}
                  className="rounded-t-none"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}