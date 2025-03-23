'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';
import CodeTabs from '@/components/docs/CodeTabs';

export default function DocumentationStyleGuidePage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Documentation Style Guide</h1>
      
      <p className="lead">
        This guide demonstrates how to use the various components available for writing beautiful, 
        consistent documentation for the Neo Service Layer.
      </p>
      
      <p>
        Our documentation uses a set of custom components designed to make technical content clear, 
        accessible, and visually appealing. This guide shows you how to use these components in 
        your documentation pages.
      </p>
      
      <h2 id="headings">Headings and Structure</h2>
      
      <p>
        Use headings (h1, h2, h3, etc.) to create a clear hierarchical structure. This helps readers 
        navigate the content and creates automatic entries in the table of contents.
      </p>
      
      <CodeBlock 
        language="jsx" 
        code={`<h1>Main Title</h1>
<h2>Major Section</h2>
<h3>Subsection</h3>
<h4>Minor section</h4>`}
        caption="Example of heading hierarchy"
      />
      
      <p>
        Always add an <code>id</code> attribute to your headings for direct linking:
      </p>
      
      <CodeBlock 
        language="jsx" 
        code={`<h2 id="getting-started">Getting Started</h2>`}
        caption="Example of heading with ID for linking"
      />
      
      <h2 id="callouts">Callouts</h2>
      
      <p>
        Use callouts to highlight important information. We have several types of callouts 
        for different purposes.
      </p>
      
      <Callout type="info" title="Information">
        This is an information callout. Use it for general notes and additional context.
      </Callout>
      
      <Callout type="warning" title="Warning">
        This is a warning callout. Use it to alert users about potential issues or important considerations.
      </Callout>
      
      <Callout type="success" title="Success">
        This is a success callout. Use it to highlight best practices or completed steps.
      </Callout>
      
      <Callout type="error" title="Error">
        This is an error callout. Use it to highlight common errors and how to resolve them.
      </Callout>
      
      <Callout type="tip" title="Tip">
        This is a tip callout. Use it to provide helpful shortcuts or efficiency suggestions.
      </Callout>
      
      <CodeBlock 
        language="jsx" 
        code={`import Callout from '@/components/docs/Callout';

<Callout type="info" title="Optional Custom Title">
  This is an information callout with custom title.
</Callout>

<Callout type="warning">
  This is a warning callout with default title.
</Callout>`}
        caption="Example of implementing callouts"
      />
      
      <h2 id="code-blocks">Code Blocks</h2>
      
      <p>
        Use code blocks to show code examples with syntax highlighting. You can add a filename 
        and caption for context.
      </p>
      
      <CodeBlock 
        language="javascript" 
        code={`function main(args) {
  // Get the name from the arguments or use "World" as default
  const name = args.name || "World";
  
  // Log something to the function execution logs
  console.log("Function executed with name:", name);
  
  // Return a simple greeting
  return {
    message: \`Hello, \${name}!\`,
    timestamp: new Date().toISOString()
  };
}`}
        filename="hello.js"
        caption="Example JavaScript function for Neo Service Layer"
      />
      
      <CodeBlock 
        language="jsx" 
        code={`import CodeBlock from '@/components/docs/CodeBlock';

<CodeBlock 
  language="javascript" 
  code={\`function example() { 
  return "Hello world";
}\`}
  filename="example.js"
  caption="Optional caption for the code block"
/>`}
        caption="Example of implementing a code block"
      />
      
      <h2 id="code-tabs">Code Tabs</h2>
      
      <p>
        Use code tabs to show examples in multiple languages or configurations.
      </p>
      
      <CodeTabs
        tabs={[
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `import { NeoServiceLayer } from 'neo-service-layer-sdk';

const serviceLayer = new NeoServiceLayer({
  apiKey: 'YOUR_API_KEY',
  network: 'mainnet',
});

async function checkBalance() {
  const balance = await serviceLayer.gasBank.getBalance();
  console.log('Current balance:', balance.balance, 'GAS');
}

checkBalance();`,
            filename: 'check-balance.js'
          },
          {
            label: 'Go',
            language: 'go',
            code: `package main

import (
    "fmt"
    
    nsl "github.com/neo-service-layer/sdk"
)

func main() {
    client := nsl.NewClient(nsl.Config{
        APIKey:  "YOUR_API_KEY",
        Network: "mainnet",
    })
    
    // Get balance
    balance, err := client.GasBank.GetBalance()
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }
    
    fmt.Printf("Current balance: %s GAS\\n", balance.Balance)
}`,
            filename: 'check_balance.go'
          }
        ]}
        caption="Examples of checking GasBank balance in different languages"
      />
      
      <CodeBlock 
        language="jsx" 
        code={`import CodeTabs from '@/components/docs/CodeTabs';

<CodeTabs
  tabs={[
    {
      label: 'JavaScript',
      language: 'javascript',
      code: \`// JavaScript code here\`,
      filename: 'example.js'
    },
    {
      label: 'Python',
      language: 'python',
      code: \`# Python code here\`,
      filename: 'example.py'
    }
  ]}
  caption="Optional caption for all tabs"
/>`}
        caption="Example of implementing code tabs"
      />
      
      <h2 id="links">Links</h2>
      
      <p>
        Use Next.js Link component for internal links and regular anchor tags for external links.
      </p>
      
      <CodeBlock 
        language="jsx" 
        code={`import Link from 'next/link';

{/* Internal links */}
<Link href="/docs/services/functions" className="text-primary hover:underline">
  Functions Service
</Link>

{/* External links */}
<a 
  href="https://github.com/R3E-Network/service_layer" 
  target="_blank"
  rel="noopener noreferrer"
  className="text-primary hover:underline"
>
  GitHub Repository
</a>`}
        caption="Example of creating links"
      />
      
      <h2 id="images">Images</h2>
      
      <p>
        Use the Next.js Image component for optimized images. Include alt text for accessibility.
      </p>
      
      <CodeBlock 
        language="jsx" 
        code={`import Image from 'next/image';

<figure className="my-8">
  <Image
    src="/images/architecture-diagram.png"
    alt="Neo Service Layer Architecture Diagram"
    width={800}
    height={500}
    className="rounded-lg shadow-md"
  />
  <figcaption className="text-center text-sm text-gray-500 mt-2">
    Figure 1: Neo Service Layer Architecture
  </figcaption>
</figure>`}
        caption="Example of adding an image with caption"
      />
      
      <h2 id="tables">Tables</h2>
      
      <p>
        Use tables to present structured data.
      </p>
      
      <div className="overflow-x-auto my-8">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documentation</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Functions</td>
              <td className="px-6 py-4 text-sm text-gray-500">Execute JavaScript functions in a secure TEE</td>
              <td className="px-6 py-4 text-sm text-primary"><Link href="/docs/services/functions">View docs</Link></td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Gas Bank</td>
              <td className="px-6 py-4 text-sm text-gray-500">Manage GAS tokens for service operations</td>
              <td className="px-6 py-4 text-sm text-primary"><Link href="/docs/services/gas-bank">View docs</Link></td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Price Feed</td>
              <td className="px-6 py-4 text-sm text-gray-500">Access reliable token price data</td>
              <td className="px-6 py-4 text-sm text-primary"><Link href="/docs/services/price-feed">View docs</Link></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <CodeBlock 
        language="jsx" 
        code={`<div className="overflow-x-auto my-8">
  <table className="min-w-full divide-y divide-gray-200 border">
    <thead className="bg-gray-50">
      <tr>
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Service Name
        </th>
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Description
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      <tr>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          Functions
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          Execute JavaScript functions in a secure TEE
        </td>
      </tr>
    </tbody>
  </table>
</div>`}
        caption="Example of creating tables"
      />
      
      <h2 id="next-steps">Next Steps</h2>
      
      <p>
        Implement these components in your documentation pages to create a consistent, 
        beautiful, and easy-to-follow experience for users.
      </p>
      
      <div className="flex flex-col md:flex-row gap-4 my-8">
        <Link 
          href="/docs/getting-started" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Getting Started</h3>
          <p className="text-gray-600 mb-4">Learn the basics of Neo Service Layer</p>
          <span className="text-primary">Explore →</span>
        </Link>
        
        <Link 
          href="/docs/services/functions" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Functions Service</h3>
          <p className="text-gray-600 mb-4">Create secure JavaScript functions</p>
          <span className="text-primary">Learn more →</span>
        </Link>
      </div>
    </div>
  );
}