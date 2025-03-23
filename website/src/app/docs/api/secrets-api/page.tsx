'use client';

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function SecretsApiPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Secrets API Reference</h1>
      
      <p className="lead">
        The Secrets API allows you to programmatically manage secrets for your Neo Service Layer account.
      </p>
      
      <Callout type="info">
        This is a basic version of the Secrets API documentation. It will be expanded with more detailed content in future updates.
      </Callout>
      
      <h2 id="overview">API Overview</h2>
      
      <p>
        The Secrets API provides endpoints for creating, retrieving, updating, and deleting secrets. 
        Secrets are sensitive pieces of information like API keys, credentials, or configuration values 
        that are stored securely and can be accessed by your functions running in the TEE.
      </p>
      
      <h2 id="base-url">Base URL</h2>
      
      <CodeBlock 
        language="text"
        code={`https://api.neoservicelayer.com/v1/secrets`}
      />
      
      <h2 id="endpoints">Endpoints</h2>
      
      <div className="space-y-12">
        {/* List Secrets */}
        <section className="border-b border-gray-200 pb-8">
          <h3 className="text-xl font-semibold" id="list-secrets">List Secrets</h3>
          <p>Retrieves a list of secrets in your account, without their values.</p>
          
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="font-mono font-bold text-green-700 mb-2">GET /secrets</p>
            
            <h4 className="text-lg font-semibold">Example Request</h4>
            <CodeBlock 
              language="bash"
              code={`curl -X GET "https://api.neoservicelayer.com/v1/secrets" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
            />
            
            <h4 className="text-lg font-semibold">Response</h4>
            <CodeBlock 
              language="json"
              code={`{
  "secrets": [
    {
      "id": "sec_123456789",
      "name": "database-password",
      "createdAt": "2023-03-15T10:30:45Z",
      "updatedAt": "2023-03-15T10:30:45Z"
    },
    {
      "id": "sec_987654321",
      "name": "api-key",
      "createdAt": "2023-03-10T15:20:30Z",
      "updatedAt": "2023-03-12T09:15:22Z"
    }
  ],
  "pagination": {
    "total": 2,
    "limit": 20,
    "offset": 0
  }
}`}
            />
          </div>
        </section>
        
        {/* Create Secret */}
        <section className="border-b border-gray-200 pb-8">
          <h3 className="text-xl font-semibold" id="create-secret">Create Secret</h3>
          <p>Creates a new secret in your account.</p>
          
          <Callout type="warning">
            The secret value is only transmitted over HTTPS and is encrypted at rest. For maximum security, 
            consider rotating your secrets regularly.
          </Callout>
          
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="font-mono font-bold text-blue-700 mb-2">POST /secrets</p>
            
            <h4 className="text-lg font-semibold">Request Body</h4>
            <CodeBlock 
              language="json"
              code={`{
  "name": "api-key",
  "value": "YOUR_SECRET_VALUE",
  "description": "API key for external service"
}`}
            />
            
            <h4 className="text-lg font-semibold">Example Request</h4>
            <CodeBlock 
              language="bash"
              code={`curl -X POST "https://api.neoservicelayer.com/v1/secrets" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "api-key",
    "value": "YOUR_SECRET_VALUE",
    "description": "API key for external service"
  }'`}
            />
            
            <h4 className="text-lg font-semibold">Response</h4>
            <CodeBlock 
              language="json"
              code={`{
  "id": "sec_123456789",
  "name": "api-key",
  "description": "API key for external service",
  "createdAt": "2023-03-15T10:30:45Z",
  "updatedAt": "2023-03-15T10:30:45Z"
}`}
            />
          </div>
        </section>
        
        {/* Delete Secret */}
        <section>
          <h3 className="text-xl font-semibold" id="delete-secret">Delete Secret</h3>
          <p>Permanently deletes a secret from your account.</p>
          
          <Callout type="error" title="Warning: Irreversible Action">
            Deleting a secret is permanent and cannot be undone. Make sure no functions or 
            automations are using the secret before deleting it.
          </Callout>
          
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="font-mono font-bold text-red-700 mb-2">DELETE /secrets/{`{secretId}`}</p>
            
            <h4 className="text-lg font-semibold">Path Parameters</h4>
            <ul>
              <li><code>secretId</code> (required) - The ID of the secret to delete</li>
            </ul>
            
            <h4 className="text-lg font-semibold">Example Request</h4>
            <CodeBlock 
              language="bash"
              code={`curl -X DELETE "https://api.neoservicelayer.com/v1/secrets/sec_123456789" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
            />
            
            <h4 className="text-lg font-semibold">Response</h4>
            <CodeBlock 
              language="json"
              code={`{
  "success": true,
  "message": "Secret deleted successfully"
}`}
            />
          </div>
        </section>
      </div>
      
      <h2 id="using-secrets">Using Secrets in Functions</h2>
      
      <p>
        Once you've created a secret, you can access it within your functions using the <code>secrets</code> object:
      </p>
      
      <CodeBlock 
        language="javascript"
        code={`async function main(context) {
  // Access a stored secret
  const apiKey = await context.secrets.get('api-key');
  
  // Use the secret in your function
  // ...
  
  return { success: true };
}`}
      />
      
      <p>
        For more information on using secrets in your functions, see the 
        <Link href="/docs/guides/secrets-guide" className="text-primary hover:underline"> Managing Secrets Guide</Link>.
      </p>
      
      <h2 id="error-codes">Error Codes</h2>
      
      <div className="overflow-x-auto my-8">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error Code</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">400</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">INVALID_REQUEST</td>
              <td className="px-6 py-4 text-sm text-gray-500">The request was invalid or missing required parameters</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">401</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">UNAUTHORIZED</td>
              <td className="px-6 py-4 text-sm text-gray-500">Invalid or missing API key</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">403</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">FORBIDDEN</td>
              <td className="px-6 py-4 text-sm text-gray-500">Insufficient permissions to perform the operation</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">404</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">NOT_FOUND</td>
              <td className="px-6 py-4 text-sm text-gray-500">The requested secret was not found</td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">409</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">CONFLICT</td>
              <td className="px-6 py-4 text-sm text-gray-500">A secret with the same name already exists</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}