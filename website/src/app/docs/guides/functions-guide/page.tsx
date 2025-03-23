'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function FunctionsGuidePage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Creating Functions Guide</h1>
      
      <p className="lead">
        This comprehensive guide will walk you through the process of creating, deploying, and managing 
        Functions on the Neo Service Layer.
      </p>
      
      <Callout type="info">
        This is a basic version of the functions guide. It will be expanded with more detailed content in future updates.
      </Callout>
      
      <h2 id="what-are-functions">What are Functions?</h2>
      
      <p>
        Functions in the Neo Service Layer allow you to deploy and execute JavaScript code within our secure 
        Trusted Execution Environment (TEE). These functions can be triggered by various events, including 
        scheduled times, blockchain events, or direct API calls.
      </p>
      
      <h2 id="creating-your-first-function">Creating Your First Function</h2>
      
      <p>
        To create a function, you'll need to write JavaScript code that follows our function structure. 
        Here's a simple example:
      </p>
      
      <CodeBlock 
        language="javascript"
        code={`function main(args) {
  // Get the name from arguments or use a default
  const name = args.name || "World";
  
  // Log something to the function execution logs
  console.log("Function executed with name:", name);
  
  // Return a simple response
  return {
    message: \`Hello, \${name}!\`,
    timestamp: new Date().toISOString()
  };
}`}
        filename="hello.js"
      />
      
      <p>
        For a more detailed guide on creating your first function, see our 
        <Link href="/docs/guides/first-function" className="text-primary hover:underline"> step-by-step tutorial</Link>.
      </p>
      
      <h2 id="further-learning">Further Learning</h2>
      
      <div className="flex flex-col md:flex-row gap-4 my-8">
        <Link 
          href="/docs/services/functions" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Functions Service</h3>
          <p className="text-gray-600 mb-4">Learn more about the Functions service</p>
          <span className="text-primary">View Documentation →</span>
        </Link>
        
        <Link 
          href="/docs/api/functions-api" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Functions API</h3>
          <p className="text-gray-600 mb-4">Explore the Functions API reference</p>
          <span className="text-primary">View API →</span>
        </Link>
      </div>
    </div>
  );
}