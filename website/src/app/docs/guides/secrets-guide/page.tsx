'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function SecretsGuidePage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Managing Secrets Guide</h1>
      
      <p className="lead">
        Learn how to securely store and use sensitive information with the Neo Service Layer Secrets service.
      </p>
      
      <Callout type="info">
        This is a basic version of the secrets management guide. It will be expanded with more detailed content in future updates.
      </Callout>
      
      <h2 id="what-are-secrets">What are Secrets?</h2>
      
      <p>
        The Secrets service provides a secure way to store sensitive information like API keys, credentials, 
        and configuration values. These secrets are:
      </p>
      
      <ul>
        <li>Encrypted at rest and in transit</li>
        <li>Only decrypted inside the Trusted Execution Environment (TEE)</li>
        <li>Never exposed outside the TEE, even to our operators</li>
        <li>Version-controlled for audit purposes</li>
      </ul>
      
      <Callout type="warning" title="Important Security Note">
        Never hardcode sensitive information in your functions or automation configurations. 
        Always use the Secrets service to handle sensitive data.
      </Callout>
      
      <h2 id="using-secrets">Using Secrets in Functions</h2>
      
      <p>
        Once you've stored a secret, you can access it within a function using the <code>secrets</code> object:
      </p>
      
      <CodeBlock 
        language="javascript"
        code={`async function main(context) {
  // Access a stored API key
  const apiKey = await context.secrets.get('external-api-key');
  
  // Use the API key to make an authenticated request
  const response = await fetch('https://api.example.com/data', {
    headers: {
      'Authorization': \`Bearer \${apiKey}\`
    }
  });
  
  const data = await response.json();
  return data;
}`}
        filename="using-secrets.js"
      />
      
      <h2 id="best-practices">Best Practices</h2>
      
      <ul>
        <li>Give each secret a descriptive name that indicates its purpose</li>
        <li>Limit access to secrets based on the principle of least privilege</li>
        <li>Rotate secrets regularly, especially for production environments</li>
        <li>Use different secrets for development, testing, and production</li>
      </ul>
      
      <h2 id="further-learning">Further Learning</h2>
      
      <div className="flex flex-col md:flex-row gap-4 my-8">
        <Link 
          href="/docs/services/secrets" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Secrets Service</h3>
          <p className="text-gray-600 mb-4">Learn more about the Secrets service</p>
          <span className="text-primary">View Documentation →</span>
        </Link>
        
        <Link 
          href="/docs/api/secrets-api" 
          className="flex-1 block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Secrets API</h3>
          <p className="text-gray-600 mb-4">Explore the Secrets API reference</p>
          <span className="text-primary">View API →</span>
        </Link>
      </div>
    </div>
  );
}