'use client';

export default function GasBankAPIPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>GasBank API Reference</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The GasBank API allows you to manage your GAS token deposits and withdrawals programmatically. 
          This API enables you to automate funding and monitor usage across your Neo Service Layer applications.
        </p>
      </div>
      
      <h2>Authentication</h2>
      <p>
        All GasBank API endpoints require authentication using your API key. Include your API key in the 
        request headers:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`Authorization: Bearer YOUR_API_KEY`}
      </pre>
      
      <h2>Base URL</h2>
      <p>
        All API requests should be made to:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`https://api.neoservicelayer.com/v1`}
      </pre>
      
      <h2>Endpoints</h2>
      
      <div className="space-y-12">
        {/* Get Balance */}
        <section className="border-b border-gray-200 pb-8">
          <h3 className="text-xl font-semibold" id="get-balance">Get Balance</h3>
          <p>Retrieves the current GAS balance in your GasBank account.</p>
          
          <div className="bg-gray-100 p-4 rounded-md">
            <p className="font-mono font-bold text-green-700 mb-2">GET /gasbank/balance</p>
            
            <h4 className="text-lg font-semibold">Parameters</h4>
            <p>No parameters required.</p>
            
            <h4 className="text-lg font-semibold">Response</h4>
            <pre className="bg-gray-200 p-4 rounded-md">
{`{
  "balance": "10.5",      // Current GAS balance as a string
  "currency": "GAS",      // Currency type (always GAS)
  "pendingDeposits": "0", // Pending deposits not yet confirmed
  "pendingWithdrawals": "0", // Pending withdrawals not yet processed
  "lastUpdated": "2023-03-15T14:30:45Z" // Timestamp of last balance update
}`}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}