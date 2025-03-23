"use client";

import Link from 'next/link';

export default function SecretsServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Secrets Management Service</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Secrets Management Service provides a secure way to store and access sensitive information
          such as API keys, private credentials, and other secrets within the Neo N3 Service Layer ecosystem.
          All secrets are encrypted at rest and only accessible within the Trusted Execution Environment (TEE).
        </p>
      </div>
      
      <h2>Key Features</h2>
      <ul>
        <li>Secure storage of sensitive data using encryption at rest and in transit</li>
        <li>Access control with fine-grained permissions</li>
        <li>Versioning of secrets to track changes</li>
        <li>Automatic rotation support for applicable secrets</li>
        <li>Seamless integration with the Functions service</li>
        <li>Secure access within the TEE environment only</li>
      </ul>
      
      <h2>Why Use the Secrets Management Service?</h2>
      <p>
        Storing sensitive information directly in your application code or configuration files is insecure and 
        creates maintenance challenges. The Secrets Management Service solves these problems by:
      </p>
      <ul>
        <li>Providing a central, secure repository for all your secrets</li>
        <li>Enabling access to secrets only in secure execution environments</li>
        <li>Separating secret management from application deployment</li>
        <li>Allowing secret updates without code changes</li>
        <li>Supporting audit trails for secret access and modifications</li>
      </ul>
      
      <h2>Creating and Managing Secrets</h2>
      <p>
        You can create, update, and delete secrets through the API or web dashboard. Each secret has:
      </p>
      <ul>
        <li>A unique name for identification</li>
        <li>The sensitive value to be stored securely</li>
        <li>Optional metadata (description, tags, etc.)</li>
        <li>Access permissions</li>
        <li>Version history</li>
      </ul>
      
      <h3>Secret Types</h3>
      <p>
        The Secrets Management Service supports different types of secrets:
      </p>
      <ul>
        <li><strong>String Secrets</strong>: For API keys, passwords, and other text-based secrets</li>
        <li><strong>File Secrets</strong>: For certificates, private keys, and other file-based secrets</li>
        <li><strong>JSON Secrets</strong>: For structured data like configuration objects</li>
      </ul>
      
      <h2>Accessing Secrets in Functions</h2>
      <p>
        Secrets can be accessed from within JavaScript functions using the <code>secrets</code> object:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`function main(args) {
  // Get a secret by name
  const apiKey = secrets.get('my_api_key');
  
  // Get a JSON secret
  const credentials = secrets.get('database_credentials');
  
  // Use the secret
  const response = await fetch('https://api.example.com/data', {
    headers: {
      'Authorization': 'Bearer ' + apiKey
    }
  });
  
  // Never return secrets directly in your function response!
  return {
    success: true,
    data: await response.json()
  };
}`}
      </pre>
      
      <div className="bg-yellow-50 p-6 rounded-lg my-8 border-l-4 border-yellow-400">
        <h3 className="text-xl font-semibold text-yellow-800 mt-0">Important Security Note</h3>
        <p className="mb-0">
          Never return secrets directly in your function responses. This would expose the secret values to 
          the caller. Always use secrets internally and only return derived data.
        </p>
      </div>
      
      <h2>Security Considerations</h2>
      <p>
        The Secrets Management Service is designed with security as the top priority:
      </p>
      <ul>
        <li>
          <strong>Encryption at Rest:</strong> All secrets are encrypted before being stored, using industry-standard
          encryption algorithms.
        </li>
        <li>
          <strong>Encryption in Transit:</strong> All communications with the Secrets API use TLS to protect
          data in transit.
        </li>
        <li>
          <strong>Access Control:</strong> Fine-grained access controls determine which functions and users can
          access each secret.
        </li>
        <li>
          <strong>TEE Isolation:</strong> Secrets are only decrypted inside the secure Trusted Execution Environment,
          which protects against host and infrastructure attacks.
        </li>
        <li>
          <strong>Audit Logging:</strong> All access to secrets is logged for audit and compliance purposes.
        </li>
      </ul>
      
      <h2>Best Practices</h2>
      <p>
        Follow these best practices when working with the Secrets Management Service:
      </p>
      <ul>
        <li>Use descriptive names for secrets that indicate their purpose</li>
        <li>Rotate secrets regularly, especially for high-sensitivity credentials</li>
        <li>Set appropriate access permissions for each secret</li>
        <li>Never log or display secret values, even in debug output</li>
        <li>Use the minimum number of secrets needed for your application</li>
        <li>Document the purpose and usage of each secret in your organization</li>
      </ul>
      
      <h2>Using Secrets with Other Services</h2>
      <p>
        Secrets can be used with other Service Layer components:
      </p>
      <ul>
        <li>
          <strong>Functions Service:</strong> Access secrets securely in your JavaScript functions
        </li>
        <li>
          <strong>Automation Service:</strong> Use secrets in automated tasks without exposing sensitive data
        </li>
        <li>
          <strong>Oracle Service:</strong> Authenticate with external APIs using securely stored credentials
        </li>
      </ul>
      
      <h2>Example Use Cases</h2>
      
      <h3>API Authentication</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`function main(args) {
  // Get the API key from secrets
  const apiKey = secrets.get('weather_api_key');
  
  // Call weather API for the requested location
  const location = args.location || 'New York';
  const response = await fetch(
    \`https://api.weatherservice.com/data?location=\${location}\`,
    { headers: { 'X-API-Key': apiKey } }
  );
  
  if (!response.ok) {
    throw new Error('Weather API request failed');
  }
  
  const weatherData = await response.json();
  
  return {
    location: location,
    temperature: weatherData.temperature,
    conditions: weatherData.conditions,
    forecast: weatherData.forecast,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h3>Database Connection</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`function main(args) {
  // Get database credentials from secrets
  const dbConfig = secrets.get('database_credentials');
  
  // This is a simulated database query
  // In a real function, you would connect to your database
  // using the credentials from the secret
  
  // Return simulated data
  return {
    message: "Database queried successfully using stored credentials",
    recordCount: 42,
    success: true,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h2>API Reference</h2>
      <p>
        For a complete API reference, see the <Link href="/docs/api/secrets-api" className="text-primary hover:underline">Secrets API documentation</Link>.
      </p>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/guides/secrets-guide" className="text-primary hover:underline">Secrets Management Guide</Link></li>
        <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
        <li><Link href="/docs/api/secrets-api" className="text-primary hover:underline">Secrets API Reference</Link></li>
      </ul>
    </div>
  );
} 