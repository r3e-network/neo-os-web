"use client";

import Link from 'next/link';
import CodeBlock from '@/components/docs/CodeBlock';
import TabPanel from '@/components/docs/TabPanel';
import Callout from '@/components/docs/Callout';

export default function ExamplesPage() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1 className="text-4xl font-bold mb-6 text-gradient bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Code Examples</h1>
      
      <p className="lead">
        This page provides practical code examples to help you understand how to use various features of the Neo N3 Service Layer.
        Each example includes explanations and can be used as a starting point for your own applications.
      </p>
      
      <div className="my-12">
        <h2 id="function-examples">Function Service Examples</h2>
        
        <div className="my-8">
          <h3>Example 1: Token Balance Checker</h3>
          <p>
            This function retrieves and returns the NEO and GAS balance for a given address.
          </p>
          
          <CodeBlock
            language="javascript"
            code={`// Token Balance Checker
// Retrieves NEO and GAS balance for a given address

function main(args) {
  // Validate input
  if (!args.address) {
    return { error: "No address provided" };
  }
  
  try {
    // Get NEO balance
    const neoBalance = neo.getBalance(args.address, 'NEO');
    
    // Get GAS balance
    const gasBalance = neo.getBalance(args.address, 'GAS');
    
    // Return formatted results
    return {
      address: args.address,
      balances: {
        neo: neoBalance,
        gas: gasBalance
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error.message,
      address: args.address
    };
  }
}`}
          />
          
          <h4>Usage Example</h4>
          <CodeBlock
            language="javascript"
            code={`// Invoke the function
const result = await serviceLayer.functions.invoke("tokenBalanceChecker", {
  address: "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr"
});

console.log(result);
// Output:
// {
//   "address": "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr",
//   "balances": {
//     "neo": "100.0",
//     "gas": "25.34928451"
//   },
//   "timestamp": "2023-03-22T12:34:56.789Z"
// }
`}
          />
        </div>
        
        <div className="my-8">
          <h3>Example 2: Price Alert Function</h3>
          <p>
            This function checks if a token's price has moved beyond specified thresholds and sends notifications.
          </p>
          
          <CodeBlock
            language="javascript"
            code={`// Price Alert Function
// Monitors token prices and sends alerts when thresholds are crossed

async function main(args) {
  // Input validation
  if (!args.token || !args.upperThreshold || !args.lowerThreshold) {
    return { error: "Missing required parameters" };
  }
  
  try {
    // Get current token price using the Price Feed service
    const tokenPrice = await priceFeed.getPrice(args.token);
    
    // Get previous price from our last run (stored in a secret)
    let previousData = {};
    try {
      const storedData = await secrets.get('previous_price_data');
      previousData = JSON.parse(storedData || '{}');
    } catch (e) {
      // This might be the first run, so we'll create the data
      console.log("No previous price data found, creating new entry");
    }
    
    const previousPrice = previousData[args.token] || tokenPrice;
    
    // Check if price crossed any thresholds
    const crossedUpper = previousPrice < args.upperThreshold && tokenPrice >= args.upperThreshold;
    const crossedLower = previousPrice > args.lowerThreshold && tokenPrice <= args.lowerThreshold;
    
    // Store the current price for next run
    previousData[args.token] = tokenPrice;
    await secrets.put('previous_price_data', JSON.stringify(previousData));
    
    // If a threshold was crossed, send notification
    if (crossedUpper || crossedLower) {
      const message = crossedUpper
        ? \`\${args.token} price crossed above \${args.upperThreshold}! Current price: \${tokenPrice}\`
        : \`\${args.token} price crossed below \${args.lowerThreshold}! Current price: \${tokenPrice}\`;
      
      // Send notification (assuming we have a webhook URL in secrets)
      const webhookUrl = await secrets.get('notification_webhook');
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
      }
      
      return {
        alertTriggered: true,
        threshold: crossedUpper ? 'upper' : 'lower',
        token: args.token,
        price: tokenPrice,
        message
      };
    }
    
    // No alert triggered
    return {
      alertTriggered: false,
      token: args.token,
      price: tokenPrice
    };
  } catch (error) {
    return { error: error.message };
  }
}`}
          />
          
          <h4>Scheduling the Alert Function</h4>
          <CodeBlock
            language="javascript"
            code={`// Schedule this function to run every hour
const automation = await serviceLayer.automation.create({
  name: "Hourly NEO Price Alert",
  schedule: "0 * * * *", // Cron expression for hourly execution
  function: "priceAlertFunction",
  functionArgs: {
    token: "NEO",
    upperThreshold: 15.00,
    lowerThreshold: 10.00
  }
});

console.log("Created automation:", automation.id);`}
          />
        </div>
      </div>
      
      <div className="my-12">
        <h2 id="automation-examples">Automation Service Examples</h2>
        
        <div className="my-8">
          <h3>Example: Contract Event Listener</h3>
          <p>
            This example shows how to set up an automation that triggers when specific events occur in a smart contract.
          </p>
          
          <TabPanel
            tabs={[
              {
                label: "Automation Setup",
                content: (
                  <CodeBlock
                    language="javascript"
                    code={`// Set up an automation to listen for Transfer events on a NEP-17 token contract
const automation = await serviceLayer.automation.create({
  name: "Token Transfer Monitor",
  trigger: {
    type: "contract_event",
    contractHash: "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79", // Example NEP-17 token
    eventName: "Transfer",
    
    // Optional: filter conditions
    filter: {
      // Only trigger for transfers to this address
      toAddress: "NhGomBpYnKXArr55nHRQ5rzy79TwKVXZbr"
    }
  },
  
  // Function to call when the event occurs
  function: "processTransfer",
  
  // Dynamic function arguments that include event data
  functionArgs: {
    // Special syntax to pass event data to the function
    fromAddress: "$event.from",
    toAddress: "$event.to",
    amount: "$event.amount",
    txid: "$event.txid"
  }
});

console.log("Created automation:", automation.id);`}
                  />
                )
              },
              {
                label: "Handler Function",
                content: (
                  <CodeBlock
                    language="javascript"
                    code={`// processTransfer function that will be called when a Transfer event is detected
async function main(args) {
  // Log the transfer details
  console.log(\`Transfer detected from \${args.fromAddress} to \${args.toAddress}\`);
  console.log(\`Amount: \${args.amount}, Transaction ID: \${args.txid}\`);
  
  // Example: Record this transfer in an external system
  const apiKey = await secrets.get('external_api_key');
  
  // Send the transfer data to an external API
  const response = await fetch('https://api.example.com/transfers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${apiKey}\`
    },
    body: JSON.stringify({
      from: args.fromAddress,
      to: args.toAddress,
      amount: args.amount,
      txid: args.txid,
      timestamp: new Date().toISOString()
    })
  });
  
  if (!response.ok) {
    throw new Error(\`Failed to record transfer: \${response.status} \${response.statusText}\`);
  }
  
  const result = await response.json();
  
  return {
    success: true,
    recordId: result.id,
    message: "Transfer recorded successfully"
  };
}`}
                  />
                )
              }
            ]}
          />
        </div>
      </div>
      
      <div className="my-12">
        <h2 id="gas-bank-examples">Gas Bank Service Examples</h2>
        
        <div className="my-8">
          <h3>Example: Sponsored User Transaction</h3>
          <p>
            This example demonstrates how to use the Gas Bank to sponsor user transactions, allowing users to interact with
            smart contracts without needing to own GAS themselves.
          </p>
          
          <CodeBlock
            language="javascript"
            code={`// Function to initiate a user transaction with gas sponsorship
async function main(args) {
  // Validate input
  if (!args.userAddress || !args.amount || !args.tokenAddress) {
    return { error: "Missing required parameters" };
  }
  
  // Our application's address that holds the tokens to transfer
  const appAddress = "NdUL5oDPD159KeFpD5A9zw5xNF1xLX6nLT";
  
  try {
    // Get the current token balance of the app address
    const tokenBalance = await neo.getTokenBalance(args.tokenAddress, appAddress);
    
    // Check if the app has enough tokens
    const amountToSend = parseFloat(args.amount);
    if (parseFloat(tokenBalance) < amountToSend) {
      return {
        success: false,
        error: "Insufficient token balance in application wallet"
      };
    }
    
    // Execute the token transfer using Gas Bank for gas fees
    const transferResult = await neo.invokeContract({
      scriptHash: args.tokenAddress,
      operation: "transfer",
      args: [
        appAddress,                 // from
        args.userAddress,           // to
        amountToSend * 100000000    // amount (assuming 8 decimals)
      ],
      signers: [
        {
          account: appAddress,
          scopes: "CalledByEntry"
        }
      ],
      useGasBank: true  // This flag tells the service to use Gas Bank
    });
    
    // Return success response with transaction details
    return {
      success: true,
      txid: transferResult.txid,
      from: appAddress,
      to: args.userAddress,
      amount: args.amount,
      gasUsed: transferResult.gasConsumed
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}`}
          />
          
          <h4>Client Application Example</h4>
          <p>
            How a client application might use this function:
          </p>
          
          <CodeBlock
            language="javascript"
            code={`// Client-side code to request a token transfer without the user paying gas
async function requestTokens() {
  const userAddress = await getNeoWalletAddress(); // Get user's address
  
  // Call the Service Layer API
  const response = await fetch('https://api.yourapplication.com/request-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: userAddress,
      amount: '10.0'  // Request 10 tokens
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log(\`Transaction successful! TXID: \${result.txid}\`);
    console.log(\`Received \${result.amount} tokens\`);
  } else {
    console.error(\`Failed: \${result.error}\`);
  }
}`}
          />
        </div>
      </div>
      
      <div className="my-12">
        <h2 id="secrets-examples">Secrets Management Examples</h2>
        
        <div className="my-8">
          <h3>Example: External API Integration</h3>
          <p>
            This example shows how to securely store and use API credentials for third-party services.
          </p>
          
          <CodeBlock
            language="javascript"
            code={`// Function that uses a secret to authenticate with an external weather API
async function main(args) {
  if (!args.city) {
    return { error: "City parameter is required" };
  }
  
  try {
    // Retrieve the API key from secure storage
    const apiKey = await secrets.get('weather_api_key');
    
    if (!apiKey) {
      return { error: "Weather API key not configured" };
    }
    
    // Make the API call with the secret API key
    const response = await fetch(
      \`https://api.weatherapi.com/v1/current.json?key=\${apiKey}&q=\${encodeURIComponent(args.city)}\`
    );
    
    if (!response.ok) {
      throw new Error(\`Weather API request failed: \${response.status} \${response.statusText}\`);
    }
    
    const data = await response.json();
    
    // Transform and return the relevant weather data
    return {
      city: data.location.name,
      country: data.location.country,
      temperature: {
        celsius: data.current.temp_c,
        fahrenheit: data.current.temp_f
      },
      condition: data.current.condition.text,
      humidity: data.current.humidity,
      updatedAt: data.current.last_updated
    };
    
  } catch (error) {
    return {
      error: error.message,
      city: args.city
    };
  }
}`}
          />
          
          <Callout type="info" title="Setting Up Secrets">
            <p>
              Before using this function, you would need to store your API key using the Secrets API:
            </p>
            <CodeBlock
              language="javascript"
              code={`// Store the API key securely
await serviceLayer.secrets.put('weather_api_key', 'your-api-key-here');

// The key is now securely stored and can only be accessed by 
// your functions running in the TEE environment`}
            />
          </Callout>
        </div>
      </div>
      
      <Callout type="info" title="Need More Examples?">
        <p className="mb-0">
          These examples demonstrate some common use cases, but there are many more possibilities. 
          If you need examples for specific scenarios, please check our
          <a href="https://github.com/R3E-Network/service_layer/tree/main/examples" className="text-primary hover:underline mx-1">GitHub repository</a>
          or ask in our <a href="https://discord.gg/r3e-network" className="text-primary hover:underline">Discord community</a>.
        </p>
      </Callout>
    </div>
  );
} 