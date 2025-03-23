'use client';

import Link from 'next/link';

export default function GuidesPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Neo Service Layer Guides</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Developer Guides</h2>
        <p className="mb-0">
          These guides provide step-by-step instructions for common development tasks
          using the Neo Service Layer. Each guide includes complete code examples and explanations.
        </p>
      </div>
      
      <h2>Getting Started Guides</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
          <h3 className="text-xl font-semibold mt-0">Setting Up Your Development Environment</h3>
          <p>Learn how to set up your development environment for working with Neo Service Layer</p>
          <Link href="/docs/guides/setup-environment" className="text-primary hover:underline">
            Read Guide →
          </Link>
        </div>
        
        <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
          <h3 className="text-xl font-semibold mt-0">Integrating with Neo N3 dApps</h3>
          <p>Learn how to integrate Neo Service Layer with your existing Neo N3 decentralized applications</p>
          <Link href="/docs/guides/neo-dapp-integration" className="text-primary hover:underline">
            Read Guide →
          </Link>
        </div>
      </div>
      
      <h2>Functions Guides</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
          <h3 className="text-xl font-semibold mt-0">Building Your First Function</h3>
          <p>Step-by-step guide to creating, testing and deploying your first Function</p>
          <Link href="/docs/guides/first-function" className="text-primary hover:underline">
            Read Guide →
          </Link>
        </div>
        
        <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
          <h3 className="text-xl font-semibold mt-0">External API Integration</h3>
          <p>How to securely connect to external APIs from your Functions</p>
          <Link href="/docs/guides/external-api-integration" className="text-primary hover:underline">
            Read Guide →
          </Link>
        </div>
      </div>
    </div>
  );
}