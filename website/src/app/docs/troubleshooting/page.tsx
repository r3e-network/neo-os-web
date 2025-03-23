"use client";

import Link from 'next/link';
import Callout from '@/components/docs/Callout';

export default function TroubleshootingPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1 className="text-4xl font-bold mb-6 text-gradient bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Troubleshooting</h1>
      
      <p className="lead">
        This page provides solutions to common problems you might encounter when using the Neo N3 Service Layer.
        If you can't find a solution to your issue here, please contact our support team or join our community channels.
      </p>
      
      <div className="my-8">
        <h2 id="function-issues">Function Service Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Function Execution Timeouts</h3>
            <p className="mb-4">If your function is timing out before completion:</p>
            <ul>
              <li>Ensure your function completes within the allowed execution time (default: 30 seconds)</li>
              <li>Optimize any API calls or blockchain interactions</li>
              <li>Consider breaking complex operations into smaller functions that can be chained</li>
              <li>Check for infinite loops or recursive calls without proper exit conditions</li>
              <li>If you need longer execution times, contact us to discuss higher tier options</li>
            </ul>
          </div>
          
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Memory Limit Exceeded</h3>
            <p className="mb-4">If your function exceeds the memory limit:</p>
            <ul>
              <li>Limit the size of data structures you create</li>
              <li>Avoid storing large datasets in memory</li>
              <li>Process data in smaller chunks</li>
              <li>Optimize object creation and cleanup unused references</li>
              <li>Consider using pagination when fetching large datasets from APIs</li>
            </ul>
          </div>
          
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Function Execution Errors</h3>
            <p className="mb-4">If your function fails with an error:</p>
            <ul>
              <li>Check the execution logs for specific error messages</li>
              <li>Ensure all API endpoints you're accessing are correctly configured and accessible</li>
              <li>Verify that your secret values are correctly set up and accessible</li>
              <li>Add proper error handling in your function code with try/catch blocks</li>
              <li>Test your function with smaller inputs first to identify potential issues</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="my-8">
        <h2 id="secret-issues">Secret Management Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Secret Access Issues</h3>
            <p className="mb-4">If your function can't access secrets:</p>
            <ul>
              <li>Verify the secret name matches exactly (secrets are case-sensitive)</li>
              <li>Check if the function has the necessary permissions to access the secret</li>
              <li>Ensure the secret has been properly created and saved</li>
              <li>Confirm your account has the necessary role-based permissions</li>
            </ul>
          </div>
          
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Secret Creation Failures</h3>
            <p className="mb-4">If you're unable to create or update secrets:</p>
            <ul>
              <li>Ensure you have the proper account permissions</li>
              <li>Secret names must be alphanumeric with underscores only</li>
              <li>Secret values have size limitations (max 4KB)</li>
              <li>Check if you've reached the secret quota for your account tier</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="my-8">
        <h2 id="automation-issues">Automation Service Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Triggers Not Firing</h3>
            <p className="mb-4">If your automation triggers aren't activating:</p>
            <ul>
              <li>Verify the trigger conditions are correctly configured</li>
              <li>For time-based triggers, check timezone settings</li>
              <li>For blockchain event triggers, ensure the contract address and event signature are correct</li>
              <li>Check if the automation has been paused or disabled</li>
              <li>Verify that your account has sufficient gas balance for executing the automation</li>
            </ul>
          </div>
          
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Automation Execution Failures</h3>
            <p className="mb-4">If your automation executes but fails:</p>
            <ul>
              <li>Check the execution logs for specific error messages</li>
              <li>Verify that any functions called by the automation are working correctly</li>
              <li>Ensure all required parameters are provided and correctly formatted</li>
              <li>Check if the operation needs more gas than allocated</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="my-8">
        <h2 id="gas-issues">Gas Bank Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Insufficient Gas</h3>
            <p className="mb-4">If operations fail due to insufficient gas:</p>
            <ul>
              <li>Check your current gas balance in the dashboard</li>
              <li>Deposit additional GAS if needed</li>
              <li>Verify that your spending policies aren't too restrictive</li>
              <li>For high-gas operations, consider increasing the gas limit in your policy</li>
            </ul>
          </div>
          
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Gas Deposit Issues</h3>
            <p className="mb-4">If your gas deposits aren't showing up:</p>
            <ul>
              <li>Confirm that the transaction has been confirmed on the Neo N3 blockchain</li>
              <li>Verify you sent the GAS to the correct deposit address</li>
              <li>Check if the minimum deposit amount was met</li>
              <li>Allow some time for the system to process the deposit (usually within minutes)</li>
              <li>Contact support if the deposit doesn't appear after 30 minutes</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="my-8">
        <h2 id="api-issues">API Issues</h2>
        
        <div className="space-y-6">
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Authentication Failures</h3>
            <p className="mb-4">If you're having trouble authenticating with the API:</p>
            <ul>
              <li>Ensure your API key is valid and has not expired</li>
              <li>Check if your API key has the necessary permissions</li>
              <li>Verify you're using the correct authentication header format</li>
              <li>Make sure your account is in good standing</li>
            </ul>
          </div>
          
          <div className="bg-white shadow-sm rounded-lg p-6 border-l-4 border-yellow-500">
            <h3 className="text-xl font-bold">Rate Limiting</h3>
            <p className="mb-4">If you're encountering rate limit errors:</p>
            <ul>
              <li>Check your current API usage in the dashboard</li>
              <li>Implement exponential backoff for retries</li>
              <li>Consider upgrading your plan for higher rate limits</li>
              <li>Optimize your code to reduce the number of API calls</li>
              <li>Cache results where appropriate to reduce duplicate calls</li>
            </ul>
          </div>
        </div>
      </div>
      
      <Callout type="info" title="Still Need Help?">
        <p className="mb-0">
          If you're still experiencing issues, please contact our support team
          through the <Link href="/contact" className="text-primary hover:underline">Contact page</Link> or 
          join our <a href="https://discord.gg/r3e-network" className="text-primary hover:underline">Discord community</a> for 
          assistance from our team and community members.
        </p>
      </Callout>
    </div>
  );
} 