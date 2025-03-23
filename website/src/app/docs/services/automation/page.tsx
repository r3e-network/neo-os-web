"use client";

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function AutomationServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Contract Automation Service</h1>
      
      <Callout type="info" title="Overview">
        The Contract Automation Service enables you to automate smart contract interactions on the Neo N3 blockchain
        based on various trigger conditions. It removes the need for manual intervention by executing
        predefined actions when specific events occur, such as time-based schedules, blockchain events, or external triggers.
      </Callout>
      
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
      
      <CodeBlock
        language="json"
        code={`{
  "trigger_type": "cron",
  "trigger_config": {
    "schedule": "0 0 * * *",  // Daily at midnight
    "timezone": "UTC"
  }
}`}
      />
      
      <h3>Blockchain Event Triggers</h3>
      <p>
        Execute smart contract functions in response to blockchain events:
      </p>
      <ul>
        <li><strong>Transaction Events:</strong> Trigger when specific transactions occur</li>
        <li><strong>Contract Notifications:</strong> Listen for notifications from specific contracts</li>
        <li><strong>Block Events:</strong> Execute based on new blocks or block height</li>
      </ul>
      
      <CodeBlock
        language="json"
        code={`{
  "trigger_type": "blockchain",
  "trigger_config": {
    "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
    "event_name": "Transfer"
  }
}`}
      />
      
      <h3>Price Triggers</h3>
      <p>
        Execute contract functions when token prices cross specified thresholds:
      </p>
      <ul>
        <li><strong>Price Threshold:</strong> Trigger when a token price goes above or below a threshold</li>
        <li><strong>Price Change:</strong> Trigger on a percentage price change</li>
        <li><strong>Price Stability:</strong> Trigger when a price remains stable for a set period</li>
      </ul>
      
      <CodeBlock
        language="json"
        code={`{
  "trigger_type": "price",
  "trigger_config": {
    "asset_pair": "NEO/USD",
    "condition": "above",
    "threshold": 50.0,
    "duration": 300  // Must be above threshold for 5 minutes
  }
}`}
      />
      
      <h2>Action Types</h2>
      <p>
        When a trigger condition is met, the Automation Service can perform several types of actions:
      </p>
      
      <h3>Smart Contract Invocation</h3>
      <p>
        Call a method on a Neo N3 smart contract. You can specify:
      </p>
      <ul>
        <li>Contract script hash</li>
        <li>Method name</li>
        <li>Method parameters</li>
        <li>Gas fee</li>
        <li>Signer information</li>
      </ul>
      
      <CodeBlock
        language="json"
        code={`{
  "action_type": "contract_invocation",
  "action_config": {
    "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
    "method": "transfer",
    "params": [
      {
        "type": "Hash160",
        "value": "NbnjKGMBJzJ6j5PHeYhjJDaQ5Vy5UYu4Fv"
      },
      {
        "type": "Hash160",
        "value": "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr"
      },
      {
        "type": "Integer",
        "value": "1000"
      }
    ],
    "gas_fee": 1.5,
    "use_gas_bank": true
  }
}`}
      />
      
      <h3>Function Execution</h3>
      <p>
        Execute a JavaScript function in the TEE. You can specify:
      </p>
      <ul>
        <li>Function name (must be created in the Functions Service)</li>
        <li>Function parameters</li>
        <li>Callback information for further processing</li>
      </ul>
      
      <CodeBlock
        language="json"
        code={`{
  "action_type": "function_execution",
  "action_config": {
    "function_name": "processTransfer",
    "params": {
      "contract": "0x1234567890abcdef1234567890abcdef12345678",
      "event": "Transfer",
      "debug_mode": true
    }
  }
}`}
      />
      
      <h3>HTTP Webhook</h3>
      <p>
        Send an HTTP request to an external service. You can specify:
      </p>
      <ul>
        <li>URL endpoint</li>
        <li>HTTP method</li>
        <li>Headers</li>
        <li>Request body</li>
        <li>Authentication information</li>
      </ul>
      
      <CodeBlock
        language="json"
        code={`{
  "action_type": "webhook",
  "action_config": {
    "url": "https://api.example.com/notify",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {SECRET_API_KEY}"
    },
    "body": {
      "event": "price_alert",
      "asset": "NEO",
      "price": 50.0,
      "timestamp": "{TIMESTAMP}"
    }
  }
}`}
      />
      
      <Callout type="tip" title="Template Variables">
        You can use template variables like {'{TIMESTAMP}'}, {'{TRIGGER_DATA}'}, and {'{EVENT_PARAMS}'} in your webhook
        configuration. These will be replaced with actual values when the webhook is sent.
      </Callout>
      
      <h2>Creating Automation Rules</h2>
      
      <p>
        To create an automation rule, you need to provide both trigger and action configurations. Here's a complete example:
      </p>
      
      <CodeBlock
        language="json"
        code={`{
  "name": "Daily Token Distribution",
  "description": "Distribute tokens to stakeholders every day at midnight",
  "active": true,
  
  "trigger": {
    "type": "cron",
    "config": {
      "schedule": "0 0 * * *",
      "timezone": "UTC"
    }
  },
  
  "action": {
    "type": "contract_invocation",
    "config": {
      "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
      "method": "distributeRewards",
      "params": [],
      "gas_fee": 2.0,
      "use_gas_bank": true
    }
  },
  
  "failure_handling": {
    "retry_count": 3,
    "retry_interval": 300,
    "notification_endpoint": "https://api.example.com/notify-failure"
  }
}`}
      />
      
      <h3>Example: React to Token Transfers</h3>
      
      <p>
        This example sets up an automation that listens for token transfers on a specific contract
        and executes a function when it detects a transfer:
      </p>
      
      <CodeBlock
        language="json"
        code={`{
  "name": "Token Transfer Processor",
  "description": "Process large token transfers and take action",
  "active": true,
  
  "trigger": {
    "type": "blockchain",
    "config": {
      "contract_hash": "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79", // Token contract
      "event_name": "Transfer",
      "filters": {
        "amount": {
          "condition": ">=",
          "value": 1000
        }
      }
    }
  },
  
  "action": {
    "type": "function_execution",
    "config": {
      "function_name": "processLargeTransfer",
      "params": {
        "includeSenderDetails": true,
        "includeRecipientHistory": true
      }
    }
  }
}`}
      />
      
      <h2>Smart Contract Integration</h2>
      
      <p>
        To make your smart contracts work with the Automation Service, you need to ensure they emit
        the appropriate events that the service can listen for:
      </p>
      
      <CodeBlock
        language="go"
        code={`using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;
using System;
using System.ComponentModel;

namespace SampleToken 
{
    [DisplayName("SampleToken")]
    public class SampleToken : Nep17Token
    {
        // Token transfer event that Automation Service can listen for
        [DisplayName("Transfer")]
        public static event Action<UInt160, UInt160, BigInteger> OnTransfer;
        
        // Implement transfer method that emits the event
        public bool Transfer(UInt160 from, UInt160 to, BigInteger amount)
        {
            // Implementation logic here
            
            // Emit event that Automation Service will detect
            OnTransfer(from, to, amount);
            return true;
        }
    }
}`}
      />
      
      <h2>Security Considerations</h2>
      
      <h3>Authentication and Authorization</h3>
      <p>
        All automation rules are tied to your account and can only be managed with proper authentication.
        Contract invocations use your stored credentials and are executed securely from the TEE.
      </p>
      
      <h3>Gas Management</h3>
      <p>
        Automation actions that invoke contracts require GAS for transaction fees. You can:
      </p>
      <ul>
        <li>Set a maximum GAS fee per transaction</li>
        <li>Use the Gas Bank service to manage GAS efficiently</li>
        <li>Receive notifications when your GAS balance is low</li>
      </ul>
      
      <h3>Error Handling</h3>
      <p>
        The service provides robust error handling for automation:
      </p>
      <ul>
        <li>Configurable retry mechanism for failed actions</li>
        <li>Error notifications via webhooks or email</li>
        <li>Detailed failure logs for debugging</li>
        <li>Ability to pause automations when persistent failures occur</li>
      </ul>
      
      <h2>Monitoring and Metrics</h2>
      
      <p>
        The Automation Service provides comprehensive monitoring of your automations:
      </p>
      
      <ul>
        <li>Execution history including success/failure status</li>
        <li>Resource usage metrics (GAS spent, execution time)</li>
        <li>Trigger frequency and patterns</li>
        <li>Failure analytics and common error patterns</li>
      </ul>
      
      <p>
        You can access these metrics through the dashboard or via the API.
      </p>
      
      <h2>API Reference</h2>
      
      <h3>Automation API Endpoints</h3>
      
      <ul>
        <li><code>GET /api/v1/automations</code> - List all automation rules</li>
        <li><code>GET /api/v1/automations/:id</code> - Get details of a specific automation rule</li>
        <li><code>POST /api/v1/automations</code> - Create a new automation rule</li>
        <li><code>PUT /api/v1/automations/:id</code> - Update an automation rule</li>
        <li><code>DELETE /api/v1/automations/:id</code> - Delete an automation rule</li>
        <li><code>POST /api/v1/automations/:id/enable</code> - Enable an automation rule</li>
        <li><code>POST /api/v1/automations/:id/disable</code> - Disable an automation rule</li>
        <li><code>GET /api/v1/automations/:id/executions</code> - Get execution history</li>
      </ul>
      
      <p>
        For a complete API reference, see the <Link href="/docs/api/automation-api" className="text-primary hover:underline">Automation API documentation</Link>.
      </p>
      
      <h2>Integration with Other Services</h2>
      
      <p>
        The Automation Service works seamlessly with other Service Layer components:
      </p>
      
      <ul>
        <li><strong>Functions Service:</strong> Execute functions as actions or use functions to process trigger data</li>
        <li><strong>Oracle Service:</strong> Automate oracle data updates based on schedules</li>
        <li><strong>Gas Bank:</strong> Optimize GAS usage for automated contract invocations</li>
        <li><strong>Price Feed:</strong> Trigger actions based on token price changes</li>
        <li><strong>Secrets Service:</strong> Securely store API keys and credentials for webhook actions</li>
      </ul>
      
      <h2>Use Cases</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">DeFi Automation</h3>
          <p>
            Schedule recurring token swaps, liquidity provision, or yield farming strategies.
            React to market conditions with price-based triggers.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Treasury Management</h3>
          <p>
            Automate token distributions, vesting schedules, and regular payments
            to project contributors or service providers.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Data Oracle Updates</h3>
          <p>
            Schedule regular updates of on-chain data from external sources like
            price feeds, weather data, or sports results.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Governance Automation</h3>
          <p>
            Automate proposal submissions, voting periods, and execution of 
            passed governance decisions.
          </p>
        </div>
      </div>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/guides/automation-guide" className="text-primary hover:underline">Automation Developer Guide</Link></li>
        <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
        <li><Link href="/docs/services/gas-bank" className="text-primary hover:underline">Gas Bank Service Documentation</Link></li>
        <li><Link href="/playground" className="text-primary hover:underline">Try the Playground</Link></li>
      </ul>
    </div>
  );
}