'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';
import CodeTabs from '@/components/docs/CodeTabs';

export default function AuthenticationPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>API Authentication</h1>
      
      <p className="lead">
        Learn how to authenticate with the Neo Service Layer API to access its resources securely.
      </p>
      
      <Callout type="info">
        This is a basic version of the authentication documentation. It will be expanded with more detailed content in future updates.
      </Callout>
      
      <h2 id="api-keys">API Keys</h2>
      
      <p>
        Neo Service Layer uses API keys for authentication. Each API key is associated with a specific account 
        and has a set of permissions that determine what resources it can access.
      </p>
      
      <h3 id="obtaining-api-keys">Obtaining API Keys</h3>
      
      <p>
        You can create and manage API keys through the Neo Service Layer Dashboard:
      </p>
      
      <ol>
        <li>Log in to your Neo Service Layer account</li>
        <li>Navigate to the API Settings page</li>
        <li>Click on "Create API Key"</li>
        <li>Configure the key's permissions and expiration</li>
        <li>Store the generated key securely - it will only be shown once</li>
      </ol>
      
      <Callout type="warning" title="Security Warning">
        Treat your API keys like passwords. Do not share them, check them into version control, 
        or expose them in client-side code. If an API key is compromised, revoke it immediately 
        and create a new one.
      </Callout>
      
      <h2 id="using-api-keys">Using API Keys</h2>
      
      <p>
        To authenticate your API requests, include your API key in the Authorization header:
      </p>
      
      <CodeBlock 
        language="text"
        code={`Authorization: Bearer YOUR_API_KEY`}
      />
      
      <h3 id="example-authenticated-request">Example Authenticated Request</h3>
      
      <CodeTabs
        tabs={[
          {
            label: 'cURL',
            language: 'bash',
            code: `curl -X GET "https://api.neoservicelayer.com/v1/functions" \\
  -H "Authorization: Bearer YOUR_API_KEY"`
          },
          {
            label: 'JavaScript',
            language: 'javascript',
            code: `// Using fetch
const apiKey = 'YOUR_API_KEY';

fetch('https://api.neoservicelayer.com/v1/functions', {
  method: 'GET',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`
          },
          {
            label: 'SDK',
            language: 'javascript',
            code: `// Using the JavaScript SDK
import { NeoServiceLayer } from 'neo-service-layer-sdk';

const serviceLayer = new NeoServiceLayer({
  apiKey: 'YOUR_API_KEY',
  network: 'mainnet', // or 'testnet'
});

// The SDK handles authentication automatically
async function getFunctions() {
  const functions = await serviceLayer.functions.list();
  console.log(functions);
}

getFunctions();`
          }
        ]}
        caption="Examples of making authenticated API requests"
      />
      
      <h2 id="token-expiration">Token Expiration and Renewal</h2>
      
      <p>
        API keys can be set to expire after a certain period for enhanced security. When an API key expires, 
        all requests using that key will be rejected with a 401 Unauthorized response.
      </p>
      
      <p>
        To prevent service disruption, monitor your API key expiration dates and create new keys before the old ones expire.
      </p>
      
      <h2 id="permissions">API Key Permissions</h2>
      
      <p>
        When creating an API key, you can specify what operations it can perform:
      </p>
      
      <div className="overflow-x-auto my-8">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Read</td>
              <td className="px-6 py-4 text-sm text-gray-500">Can view resources but not modify them</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Write</td>
              <td className="px-6 py-4 text-sm text-gray-500">Can create and update resources</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Execute</td>
              <td className="px-6 py-4 text-sm text-gray-500">Can invoke functions and trigger automation</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Admin</td>
              <td className="px-6 py-4 text-sm text-gray-500">Full access to all operations including deletion</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <Callout type="tip">
        Follow the principle of least privilege when creating API keys. Only grant the minimum permissions 
        necessary for the intended use case.
      </Callout>
      
      <h2 id="error-handling">Authentication Error Handling</h2>
      
      <p>
        When authentication fails, the API returns an error response with a 401 (Unauthorized) or 403 (Forbidden) status code:
      </p>
      
      <CodeBlock 
        language="json"
        code={`{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key provided"
  }
}`}
      />
      
      <h2 id="next-steps">Next Steps</h2>
      
      <p>
        Now that you understand how to authenticate with the API, explore the specific API endpoints for each service:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
        <Link 
          href="/docs/api/functions-api" 
          className="block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Functions API</h3>
          <span className="text-primary">View →</span>
        </Link>
        
        <Link 
          href="/docs/api/secrets-api" 
          className="block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Secrets API</h3>
          <span className="text-primary">View →</span>
        </Link>
        
        <Link 
          href="/docs/api/automation-api" 
          className="block p-6 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all text-center"
        >
          <h3 className="text-xl font-bold mb-2">Automation API</h3>
          <span className="text-primary">View →</span>
        </Link>
      </div>
    </div>
  );
}