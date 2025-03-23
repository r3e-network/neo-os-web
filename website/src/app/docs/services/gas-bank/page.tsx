"use client";

import Link from 'next/link';

export default function GasBankServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Gas Bank Service</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Gas Bank Service provides efficient gas management for Neo N3 blockchain operations.
          It enables applications to execute transactions without requiring end-users to hold GAS,
          simplifying user onboarding and enhancing application experiences.
        </p>
      </div>
      
      <h2>Key Features</h2>
      <ul>
        <li>Sponsor transactions for your users, removing the gas barrier to entry</li>
        <li>Bulk gas management for high-volume applications</li>
        <li>Configurable gas limits and spending policies</li>
        <li>Detailed gas usage analytics and reporting</li>
        <li>Pay-as-you-go and subscription pricing models</li>
        <li>Seamless integration with other Service Layer components</li>
        <li>Role-based access controls for team management</li>
      </ul>
      
      <h2>How Gas Bank Works</h2>
      <p>
        The Gas Bank Service works by maintaining a pool of GAS that can be used to sponsor transactions on behalf of your application and its users.
      </p>
      
      <ol>
        <li><strong>Gas Deposit:</strong> You deposit GAS to your Gas Bank account, which becomes available for your application to use</li>
        <li><strong>Policy Configuration:</strong> You define spending policies that determine how and when your gas can be used</li>
        <li><strong>Transaction Sponsorship:</strong> Your application requests gas for specific operations</li>
        <li><strong>Automatic Payment:</strong> The Gas Bank handles the transaction fees, deducting from your balance</li>
        <li><strong>Usage Tracking:</strong> All gas usage is tracked for transparency and accounting</li>
      </ol>
      
      <div className="bg-primary/10 p-6 rounded-lg my-8 border-l-4 border-primary">
        <h3 className="text-xl font-semibold text-primary-dark mt-0">Gas Efficiency</h3>
        <p className="mb-0">
          The Gas Bank optimizes gas usage through:
        </p>
        <ul className="mb-0">
          <li>Smart batching of similar transactions</li>
          <li>Dynamic gas price adjustment based on network conditions</li>
          <li>Optimized contract calling methods to reduce gas consumption</li>
          <li>Elimination of failed transaction gas waste through simulation</li>
        </ul>
      </div>
      
      <h2>Setting Up Gas Bank</h2>
      <p>
        Getting started with the Gas Bank Service involves a few simple steps:
      </p>
      
      <h3>1. Create a Gas Bank Account</h3>
      <p>
        Register for a Gas Bank account through the Service Layer dashboard or API:
      </p>
      <pre className="bg-gray-100 p-4 rounded-md">
{`POST /api/v1/gas-bank/accounts
{
  "name": "My Application Gas Bank",
  "description": "Gas bank for our DeFi application",
  "contactEmail": "team@myapp.com"
}`}
      </pre>
      
      <h3>2. Deposit GAS</h3>
      <p>
        Fund your Gas Bank account by transferring GAS to your deposit address:
      </p>
      <pre className="bg-gray-100 p-4 rounded-md">
{`// Gas bank deposit address (example)
NWx5ZT9RQcM5NMbKFECMv2C38XnFNK6J6H

// Minimum deposit: 10 GAS
// Confirmation time: ~15 seconds (1 block)`}
      </pre>
      
      <h3>3. Configure Gas Policies</h3>
      <p>
        Define spending policies to control how your gas can be used:
      </p>
      <pre className="bg-gray-100 p-4 rounded-md">
{`POST /api/v1/gas-bank/policies
{
  "name": "Standard Operations Policy",
  "maxGasPerTransaction": 20,
  "maxDailyGas": 500,
  "authorizedOperations": [
    "token_transfer",
    "contract_deploy",
    "contract_update"
  ],
  "allowedContractScriptHashes": [
    "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79"
  ],
  "allowedCallerAddresses": [
    "Nb94dB266iD7JtXs3PmpQi6q7jKR4iQGpC"
  ],
  "notificationWebhook": "https://myapp.com/webhooks/gasbank"
}`}
      </pre>
      
      <h2>Gas Bank APIs</h2>
      <p>
        The Gas Bank Service provides comprehensive APIs for integrating with your applications:
      </p>
      
      <h3>Request Transaction Sponsorship</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`POST /api/v1/gas-bank/transactions
{
  "operation": "contract_invoke",
  "scriptHash": "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79",
  "method": "transfer",
  "args": [
    {
      "type": "Hash160",
      "value": "0x1aada0032aba1ef6d1f07bbd8bec1d85f5380fb3"
    },
    {
      "type": "Hash160",
      "value": "0x6f41f04d29e11b63e71a9d1cb17da00f33d7ca7f"
    },
    {
      "type": "Integer",
      "value": "100000000"
    }
  ],
  "signers": [
    {
      "account": "0x1aada0032aba1ef6d1f07bbd8bec1d85f5380fb3",
      "scopes": "CalledByEntry"
    }
  ],
  "broadcastNow": true
}`}
      </pre>
      
      <h3>Check Gas Balance</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`GET /api/v1/gas-bank/balance

Response:
{
  "balance": "258.45931642",
  "pendingDeposits": "0",
  "reservedForPendingTransactions": "1.25000000",
  "available": "257.20931642",
  "totalSpent": "42.54068358",
  "lastUpdated": "2023-03-22T14:15:26Z"
}`}
      </pre>
      
      <h3>Get Transaction History</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`GET /api/v1/gas-bank/transactions?limit=10&offset=0

Response:
{
  "transactions": [
    {
      "id": "tx_01GZQT3R8YJDZB8F3E3VPXQ9F4",
      "txid": "0x9c57c0a94e87c690ebd4d4e12e1f731c181d889b7bc5f0e7ec8f13383a699073",
      "operation": "contract_invoke",
      "scriptHash": "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79",
      "method": "transfer",
      "gasConsumed": "0.83420000",
      "status": "confirmed",
      "timestamp": "2023-03-22T14:10:15Z"
    },
    // More transactions...
  ],
  "total": 42,
  "limit": 10,
  "offset": 0
}`}
      </pre>
      
      <h2>Using Gas Bank with Functions</h2>
      <p>
        JavaScript functions can use the Gas Bank to execute blockchain transactions:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`async function main(args) {
  const { recipientAddress, amount } = args;
  
  // Validate input parameters
  if (!recipientAddress || !amount) {
    return { error: "Missing required parameters" };
  }
  
  // Convert amount to proper format (assuming NEP-17 with 8 decimals)
  const tokenAmount = parseInt(parseFloat(amount) * 100000000);
  
  // Get the sender address
  const senderAddress = "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr"; // Your application's address
  
  // Execute token transfer using Gas Bank for gas fees
  const transferResult = await neo.invokeContract({
    scriptHash: "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79", // Example token contract
    operation: "transfer",
    args: [
      senderAddress,
      recipientAddress,
      tokenAmount
    ],
    signers: [
      {
        account: senderAddress,
        scopes: "CalledByEntry"
      }
    ],
    useGasBank: true // This flag enables Gas Bank usage
  });
  
  if (transferResult.error) {
    return { 
      success: false, 
      error: transferResult.error 
    };
  }
  
  return {
    success: true,
    txid: transferResult.txid,
    senderAddress,
    recipientAddress,
    amount,
    gasUsed: transferResult.gasConsumed,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h2>Use Cases</h2>
      
      <h3>User Onboarding</h3>
      <p>
        Remove the friction from user onboarding by sponsoring their initial transactions:
      </p>
      <ul>
        <li>Allow users to interact with your dApp without first purchasing GAS</li>
        <li>Cover gas fees for creating user wallets or account registrations</li>
        <li>Sponsor a user's first 5-10 transactions to demonstrate value before they commit</li>
      </ul>
      
      <h3>Business Operations</h3>
      <p>
        Optimize your business operations on Neo N3:
      </p>
      <ul>
        <li>Manage employee expenses by allocating gas budgets</li>
        <li>Implement departmental gas budgeting and cost tracking</li>
        <li>Simplify accounting with consolidated gas expense reports</li>
      </ul>
      
      <h3>DeFi Applications</h3>
      <p>
        Enable seamless DeFi experiences:
      </p>
      <ul>
        <li>Cover gas fees for yield harvesting operations</li>
        <li>Sponsor transactions during high-volume trading periods</li>
        <li>Implement gas rebate programs for loyal users</li>
      </ul>
      
      <h2>Example: User-Friendly NFT Minting</h2>
      <p>
        This example shows how to create a user-friendly NFT minting experience using Gas Bank:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`async function main(args) {
  const { 
    userAddress, 
    nftName, 
    nftDescription, 
    imageUrl 
  } = args;
  
  // Validate user input
  if (!userAddress || !nftName || !imageUrl) {
    return { error: "Missing required parameters" };
  }
  
  // NFT contract script hash
  const nftContractHash = "0x3dfc66447c9280d97b47c2bcf5d625d77f8d2a28";
  
  // Mint the NFT using Gas Bank for gas fees
  const mintResult = await neo.invokeContract({
    scriptHash: nftContractHash,
    operation: "mintNFT",
    args: [
      userAddress,
      nftName,
      nftDescription || "",
      imageUrl
    ],
    signers: [
      {
        account: "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr", // Contract admin address
        scopes: "CalledByEntry"
      }
    ],
    useGasBank: true
  });
  
  if (mintResult.error) {
    return { 
      success: false, 
      error: mintResult.error 
    };
  }
  
  // Get the minted token ID from the transaction result
  const tokenId = mintResult.stack[0].value;
  
  return {
    success: true,
    tokenId,
    txid: mintResult.txid,
    nftName,
    nftDescription,
    imageUrl,
    ownerAddress: userAddress,
    gasUsed: mintResult.gasConsumed,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h2>Security and Limits</h2>
      <p>
        The Gas Bank Service includes several security features and limitations:
      </p>
      <ul>
        <li><strong>Transaction Simulation:</strong> Transactions are simulated before execution to prevent wasted gas</li>
        <li><strong>Spending Limits:</strong> Configurable daily, weekly, and monthly spending caps</li>
        <li><strong>Allowlist Contracts:</strong> Restrict gas usage to specific contract script hashes</li>
        <li><strong>Operation Restrictions:</strong> Limit which types of operations can use your gas</li>
        <li><strong>Alert Thresholds:</strong> Receive notifications when usage hits defined thresholds</li>
        <li><strong>Multi-signature Controls:</strong> Require multiple approvals for large gas withdrawals</li>
      </ul>
      
      <h2>Best Practices</h2>
      <ol>
        <li>Start with strict gas policies and gradually relax them as you gain confidence</li>
        <li>Monitor your gas usage patterns to optimize costs</li>
        <li>Implement rate limiting for user-triggered gas expenditures</li>
        <li>Use transaction batching for common operations</li>
        <li>Set up alerts for unusual gas consumption patterns</li>
        <li>Regularly audit your gas usage to identify optimization opportunities</li>
        <li>Keep a reserve balance to prevent service interruptions</li>
      </ol>
      
      <h2>Integration Examples</h2>
      <h3>Gas Bank with Automation Service</h3>
      <p>
        The Gas Bank integrates seamlessly with the Automation Service to ensure automated tasks always have sufficient gas:
      </p>
      <pre className="bg-gray-100 p-4 rounded-md">
{`// Automation task configuration with Gas Bank
{
  "name": "Daily Token Distribution",
  "description": "Distribute tokens to stakers every day",
  "trigger": {
    "type": "schedule",
    "schedule": "0 0 * * *"  // Daily at midnight
  },
  "action": {
    "type": "contract",
    "scriptHash": "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79",
    "operation": "distributeRewards",
    "args": []
  },
  "gasConfig": {
    "useGasBank": true,
    "maxGasLimit": 50,
    "gasPrice": 1000,
    "budgetCategory": "Staking Rewards"
  }
}`}
      </pre>
      
      <h2>API Reference</h2>
      <p>
        For a complete API reference, see the <Link href="/docs/api/gas-bank-api" className="text-primary hover:underline">Gas Bank API documentation</Link>.
      </p>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/guides/gas-bank-guide" className="text-primary hover:underline">Gas Bank Integration Guide</Link></li>
        <li><Link href="/docs/services/automation" className="text-primary hover:underline">Automation Service Documentation</Link></li>
        <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
        <li><Link href="/docs/api/gas-bank-api" className="text-primary hover:underline">Gas Bank API Reference</Link></li>
      </ul>
    </div>
  );
} 