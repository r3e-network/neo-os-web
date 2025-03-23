"use client";

import Link from 'next/link';

export default function AutomationServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Contract Automation Service</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Contract Automation Service enables you to automate smart contract interactions on the Neo N3 blockchain
          based on various trigger conditions. It removes the need for manual intervention by executing
          predefined actions when specific events occur, such as time-based schedules, blockchain events, or external triggers.
        </p>
      </div>
      
      <h2>Key Features</h2>
      <ul>
        <li>Trigger smart contract executions based on various conditions</li>
        <li>Schedule recurring blockchain transactions</li>
        <li>Listen for specific blockchain events</li>
        <li>Connect external events to on-chain actions</li>
        <li>Conditional execution with custom logic</li>
        <li>Gas management through the Gas Bank service</li>
        <li>Detailed logs and execution history</li>
      </ul>
      
      <h2>Trigger Types</h2>
      <p>
        The Automation Service supports several types of triggers:
      </p>
      
      <h3>Time-Based Triggers</h3>
      <p>
        Execute smart contract functions on a schedule:
      </p>
      <ul>
        <li><strong>One-time:</strong> Execute a contract method at a specific date and time</li>
        <li><strong>Recurring:</strong> Execute on a recurring schedule (e.g., hourly, daily, weekly)</li>
        <li><strong>Cron-style:</strong> Use cron expressions for complex scheduling patterns</li>
      </ul>
      
      <h3>Blockchain Event Triggers</h3>
      <p>
        Execute smart contract functions in response to blockchain events:
      </p>
      <ul>
        <li><strong>Transaction Events:</strong> Trigger when specific transactions occur</li>
        <li><strong>Contract Notifications:</strong> Listen for notifications from specific contracts</li>
        <li><strong>Block Height:</strong> Execute at specific block heights</li>
        <li><strong>Asset Transfers:</strong> Trigger on NEP-17 token transfers</li>
      </ul>
      
      <h3>Data Condition Triggers</h3>
      <p>
        Execute smart contract functions when data conditions are met:
      </p>
      <ul>
        <li><strong>Price Thresholds:</strong> Trigger when a token price crosses a threshold</li>
        <li><strong>Account Balance:</strong> Execute when an account balance changes</li>
        <li><strong>Contract Storage:</strong> Trigger when specific contract storage values change</li>
      </ul>
      
      <h3>Function Result Triggers</h3>
      <p>
        Chain function executions together:
      </p>
      <ul>
        <li><strong>Function Completion:</strong> Execute when another function completes</li>
        <li><strong>Conditional Logic:</strong> Execute based on the result of another function</li>
        <li><strong>Error Handling:</strong> Trigger alternative actions when a function fails</li>
      </ul>
      
      <h2>Creating Automation Tasks</h2>
      <p>
        Automation tasks have several components:
      </p>
      <ul>
        <li><strong>Trigger:</strong> The condition that initiates the task</li>
        <li><strong>Action:</strong> The smart contract method to call or function to execute</li>
        <li><strong>Parameters:</strong> Arguments passed to the contract method or function</li>
        <li><strong>Authentication:</strong> The account used to execute the transaction</li>
        <li><strong>Gas Settings:</strong> Gas fee configuration for the transaction</li>
        <li><strong>Error Handling:</strong> How to respond to failures</li>
      </ul>
      
      <h3>Example Automation Task Configuration</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "name": "Daily Token Distribution",
  "description": "Distribute tokens to stakers every day at 00:00 UTC",
  "trigger": {
    "type": "schedule",
    "schedule": "0 0 * * *"  // Cron expression for daily at midnight
  },
  "action": {
    "type": "contract",
    "scriptHash": "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    "operation": "distributeRewards",
    "args": []
  },
  "gasConfig": {
    "gasLimit": 20,
    "gasPrice": 1000
  },
  "errorHandling": {
    "retryCount": 3,
    "retryInterval": 60
  }
}`}
      </pre>
      
      <h2>Integration with Functions Service</h2>
      <p>
        The Automation Service can call Functions to implement complex logic before executing blockchain transactions:
      </p>
      <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "name": "Price-Based Token Swap",
  "description": "Swap tokens when price conditions are favorable",
  "trigger": {
    "type": "schedule",
    "schedule": "*/10 * * * *"  // Every 10 minutes
  },
  "action": {
    "type": "function",
    "functionName": "evaluatePriceAndSwap",
    "args": {
      "tokenA": "NEO",
      "tokenB": "GAS",
      "targetPrice": 0.05
    },
    "then": {
      "type": "contract",
      "scriptHash": "0xf61eebf573ea36593fd43aa150c055ad7906ab83",
      "operation": "swap",
      "argsFromFunction": true
    }
  }
}`}
      </pre>
      
      <p>
        In this example:
      </p>
      <ol>
        <li>The automation task runs every 10 minutes</li>
        <li>It calls the <code>evaluatePriceAndSwap</code> function</li>
        <li>If the function returns a successful result, it uses the result to execute a <code>swap</code> operation on the specified contract</li>
      </ol>
      
      <div className="bg-yellow-50 p-6 rounded-lg my-8 border-l-4 border-yellow-400">
        <h3 className="text-xl font-semibold text-yellow-800 mt-0">Important Security Note</h3>
        <p className="mb-0">
          Automation tasks can execute blockchain transactions that may involve digital assets.
          Always test your automation tasks thoroughly and implement appropriate safeguards in your
          contract code and function logic.
        </p>
      </div>
      
      <h2>Common Use Cases</h2>
      
      <h3>DeFi Automation</h3>
      <ul>
        <li>Automatic liquidity provision</li>
        <li>Periodic interest distribution</li>
        <li>Price-based trading strategies</li>
        <li>Rebalancing token portfolios</li>
      </ul>
      
      <h3>Business Operations</h3>
      <ul>
        <li>Periodic payouts to stakeholders</li>
        <li>Automatic report generation</li>
        <li>Contract renewals</li>
        <li>Service subscriptions</li>
      </ul>
      
      <h3>Data Management</h3>
      <ul>
        <li>Updating on-chain oracles with external data</li>
        <li>Aggregating blockchain data</li>
        <li>Periodic data validation</li>
      </ul>
      
      <h2>Example: Token Distribution System</h2>
      <p>
        This example shows how to create a daily token distribution system for staking rewards:
      </p>
      
      <h3>Step 1: Create a Distribution Function</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`async function main(args) {
  // Calculate reward amounts based on staking data
  const stakingContractHash = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
  
  // Get total staked amount
  const totalStaked = neo.call({
    scriptHash: stakingContractHash,
    operation: "getTotalStaked",
    args: []
  });
  
  // Get stakers
  const stakers = neo.call({
    scriptHash: stakingContractHash,
    operation: "getStakers",
    args: []
  });
  
  // Calculate rewards for each staker
  const dailyEmission = 1000; // 1000 tokens per day
  const distributionData = stakers.map(staker => {
    const stakerAddress = staker.address;
    const stakerAmount = staker.amount;
    const reward = (stakerAmount / totalStaked) * dailyEmission;
    
    return {
      address: stakerAddress,
      amount: reward
    };
  });
  
  return {
    distributionData,
    totalStaked,
    totalRewards: dailyEmission
  };
}`}
      </pre>
      
      <h3>Step 2: Set Up the Automation Task</h3>
      <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "name": "Daily Token Distribution",
  "description": "Calculate and distribute staking rewards daily",
  "trigger": {
    "type": "schedule",
    "schedule": "0 0 * * *"  // Daily at midnight
  },
  "action": {
    "type": "function",
    "functionName": "calculateRewards",
    "args": {},
    "then": {
      "type": "contract",
      "scriptHash": "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      "operation": "distributeRewards",
      "argsFromFunction": true
    }
  },
  "gasConfig": {
    "gasLimit": 50,
    "gasPrice": 1000
  }
}`}
      </pre>
      
      <h2>Monitoring and Troubleshooting</h2>
      <p>
        The Automation Service provides several tools for monitoring and troubleshooting:
      </p>
      <ul>
        <li><strong>Execution History:</strong> View detailed logs of all automation task executions</li>
        <li><strong>Success/Failure Statistics:</strong> Track reliability of your automation tasks</li>
        <li><strong>Gas Usage:</strong> Monitor the gas consumption of your automation tasks</li>
        <li><strong>Error Analysis:</strong> Identify common failure patterns and root causes</li>
        <li><strong>Alerts:</strong> Set up notifications for failed or successful executions</li>
      </ul>
      
      <h2>Best Practices</h2>
      <ol>
        <li>Test automation tasks thoroughly in a test environment before deploying to production</li>
        <li>Implement safeguards in your contract code to prevent unexpected behavior</li>
        <li>Set reasonable gas limits based on the complexity of your contract operations</li>
        <li>Use retry logic for tasks that involve external data sources</li>
        <li>Monitor execution history regularly to identify issues</li>
        <li>Use conditional logic to prevent unnecessary transactions</li>
        <li>Schedule resource-intensive tasks during periods of lower network activity</li>
      </ol>
      
      <h2>API Reference</h2>
      <p>
        For a complete API reference, see the <Link href="/docs/api/automation-api" className="text-primary hover:underline">Automation API documentation</Link>.
      </p>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/guides/automation-guide" className="text-primary hover:underline">Automation Developer Guide</Link></li>
        <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
        <li><Link href="/docs/services/gas-bank" className="text-primary hover:underline">Gas Bank Service Documentation</Link></li>
        <li><Link href="/docs/api/automation-api" className="text-primary hover:underline">Automation API Reference</Link></li>
      </ul>
    </div>
  );
} 