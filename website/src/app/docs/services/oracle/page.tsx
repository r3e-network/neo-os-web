"use client";

import Link from 'next/link';
import Image from 'next/image';
import CodeBlock from '@/components/docs/CodeBlock';
import Callout from '@/components/docs/Callout';

export default function OracleServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Oracle Service</h1>
      
      <Callout type="info" title="Overview">
        The Oracle Service provides a secure bridge between the Neo N3 blockchain and external data sources.
        It enables smart contracts to access real-world data such as market prices, weather information, 
        sports results, and other off-chain data that would otherwise be inaccessible from within the blockchain.
      </Callout>
      
      <h2>Key Features</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">TEE Protection</h3>
          <p>
            All oracle operations run within a Trusted Execution Environment (TEE),
            ensuring data integrity and confidentiality.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Flexible Data Sources</h3>
          <p>
            Connect to almost any API or data source, including REST APIs, databases,
            and streaming services.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Custom Data Transformations</h3>
          <p>
            Transform and process the data before it reaches your smart contract
            to ensure it's in the right format.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Multiple Consensus Mechanisms</h3>
          <p>
            Configure your oracle to use different consensus mechanisms for data
            validation, including majority voting and threshold signatures.
          </p>
        </div>
      </div>
      
      <h2>Architecture</h2>
      
      <p>
        The Oracle Service consists of the following components:
      </p>
      
      <ol>
        <li><strong>Data Source Manager</strong>: Manages connections to external data sources</li>
        <li><strong>Request Processor</strong>: Handles oracle data requests</li>
        <li><strong>Data Validator</strong>: Validates and formats data from external sources</li>
        <li><strong>Blockchain Integration</strong>: Delivers data to Neo N3 contracts</li>
        <li><strong>Storage Layer</strong>: Records request history and data for auditing</li>
        <li><strong>TEE Runner</strong>: Executes data retrieval in a secure environment</li>
      </ol>
      
      <h3>Request Flow</h3>
      
      <p>The service follows this basic flow for delivering data:</p>
      
      <ol>
        <li>
          <strong>Request Submission</strong>:
          <ul>
            <li>Smart contract or user requests data via the API</li>
            <li>Request includes data source, parameters, and callback information</li>
          </ul>
        </li>
        <li>
          <strong>Data Collection</strong>:
          <ul>
            <li>Oracle service retrieves data from the specified external source</li>
            <li>Data is validated and formatted according to request parameters</li>
          </ul>
        </li>
        <li>
          <strong>On-chain Delivery</strong>:
          <ul>
            <li>Validated data is delivered to the requesting contract</li>
            <li>Transaction is signed and sent to the blockchain</li>
          </ul>
        </li>
        <li>
          <strong>Verification</strong>:
          <ul>
            <li>Smart contract can verify the data integrity</li>
            <li>Data provenance is recorded for auditing</li>
          </ul>
        </li>
      </ol>
      
      <h2>Supported Data Sources</h2>
      
      <p>The service supports multiple types of data sources:</p>
      
      <ul>
        <li><strong>REST APIs</strong>: HTTP/HTTPS endpoints with JSON or XML responses</li>
        <li><strong>WebSockets</strong>: Real-time data streams</li>
        <li><strong>File Systems</strong>: CSV, JSON, or XML files</li>
        <li><strong>IPFS</strong>: Decentralized file system</li>
        <li><strong>Databases</strong>: SQL or NoSQL databases</li>
        <li><strong>Custom Sources</strong>: Extendable interface for custom data sources</li>
      </ul>
      
      <h3>Authentication Methods</h3>
      
      <p>The service supports various authentication methods for external APIs:</p>
      
      <ul>
        <li>API Key authentication</li>
        <li>OAuth 2.0</li>
        <li>JWT tokens</li>
        <li>Basic authentication</li>
        <li>Custom authentication headers</li>
      </ul>
      
      <Callout type="tip" title="Security Best Practice">
        All API credentials and authentication tokens are securely stored in the TEE and never exposed to the public. 
        Use the Secrets Service to manage your API credentials.
      </Callout>
      
      <h2>Smart Contract Integration</h2>
      
      <p>
        To integrate the Oracle Service with your Neo N3 smart contracts, you need to implement a specific interface
        that can handle callbacks from the Oracle Service.
      </p>
      
      <h3>Example Oracle Consumer Contract</h3>
      
      <CodeBlock
        language="go"
        code={`// Oracle consumer contract interface
type OracleConsumer interface {
    // Request data from the oracle service
    RequestData(requestID uint64, url string, path string, callback string) bool
    
    // Callback for receiving the data
    ReceiveData(requestID uint64, data []byte, proof []byte) bool
    
    // Get the last received data
    GetLastData() (data []byte, timestamp uint64)
}`}
      />
      
      <p>
        Once you have implemented this interface, your contract can request data from the Oracle Service
        and receive the results via a callback.
      </p>
      
      <h2>API Endpoints</h2>
      
      <h3>Admin API</h3>
      
      <ul>
        <li><code>GET /api/v1/oracles</code> - List all oracle data feeds</li>
        <li><code>GET /api/v1/oracles/:id</code> - Get details of a specific oracle</li>
        <li><code>POST /api/v1/oracles</code> - Create a new oracle data feed</li>
        <li><code>PUT /api/v1/oracles/:id</code> - Update an oracle data feed</li>
        <li><code>DELETE /api/v1/oracles/:id</code> - Delete an oracle data feed</li>
        <li><code>GET /api/v1/oracles/:id/requests</code> - List requests for an oracle</li>
        <li><code>GET /api/v1/oracles/requests/:id</code> - Get details of a specific request</li>
      </ul>
      
      <h3>Public API</h3>
      
      <ul>
        <li><code>POST /api/v1/public/oracles/request</code> - Submit a new oracle data request</li>
        <li><code>GET /api/v1/public/oracles/request/:id</code> - Get the status and result of a request</li>
        <li><code>GET /api/v1/public/oracles/data/:id</code> - Get historically stored oracle data</li>
      </ul>
      
      <h3>Creating an Oracle Request</h3>
      
      <p>Here's an example of creating a new oracle request:</p>
      
      <CodeBlock
        language="json"
        code={`{
  "url": "https://api.coingecko.com/api/v3/simple/price?ids=neo&vs_currencies=usd",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "path": "$.neo.usd",
  "transform": "parseInt(data * 100)",
  "callback_address": "0x1234567890abcdef1234567890abcdef12345678",
  "callback_method": "ReceivePrice",
  "gas_fee": 0.5
}`}
      />
      
      <h2>Request Parameters</h2>
      
      <p>Oracle requests support the following parameters:</p>
      
      <ul>
        <li><code>url</code>: The API endpoint URL to fetch data from</li>
        <li><code>method</code>: HTTP method (GET, POST, etc.)</li>
        <li><code>headers</code>: Custom HTTP headers for the request</li>
        <li><code>body</code>: Request body for POST/PUT requests</li>
        <li><code>auth_type</code>: Authentication type (API_KEY, OAUTH, BASIC, etc.)</li>
        <li><code>auth_params</code>: Authentication parameters (keys, tokens, etc.)</li>
        <li><code>path</code>: JSONPath or XPath expression to extract specific data</li>
        <li><code>transform</code>: Transformation function to apply to the data</li>
        <li><code>callback_address</code>: Neo N3 contract address to receive the data</li>
        <li><code>callback_method</code>: Method to call with the data</li>
        <li><code>gas_fee</code>: GAS fee to pay for the callback transaction</li>
      </ul>
      
      <h3>JSONPath Examples</h3>
      
      <p>
        The Oracle Service uses JSONPath expressions to extract specific data from complex JSON responses. 
        Here are some examples:
      </p>
      
      <CodeBlock
        language="javascript"
        code={`// Simple price data
$.neo.usd

// First item in an array
$.results[0].price

// Multiple data points
$.data.markets[?(@.symbol=="NEO")].price

// Complex filtering
$.data.pairs[?(@.base=="NEO" && @.quote=="USD")].price`}
      />
      
      <h2>Security Features</h2>
      
      <ul>
        <li>All oracle operations execute within the TEE environment</li>
        <li>Data signatures ensure integrity from source to blockchain</li>
        <li>Rate limiting prevents API abuse and DoS attacks</li>
        <li>Input validation prevents injection attacks</li>
        <li>Secure credential storage for API authentication</li>
        <li>Detailed audit logs for all requests and responses</li>
      </ul>
      
      <h2>Performance Considerations</h2>
      
      <p>The Oracle Service includes several optimizations for performance:</p>
      
      <ul>
        <li>Connection pooling for efficient API requests</li>
        <li>Caching of frequently requested data</li>
        <li>Batched blockchain transactions for multiple data points</li>
        <li>Automatic retry mechanisms for failed requests</li>
        <li>Prioritization of time-sensitive requests</li>
      </ul>
      
      <h2>Use Cases</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="border p-3 rounded-lg">
          <h3 className="text-lg font-semibold">Financial Data</h3>
          <p className="text-sm">
            Token prices, exchange rates, interest rates, and other financial metrics.
          </p>
        </div>
        
        <div className="border p-3 rounded-lg">
          <h3 className="text-lg font-semibold">Sports & Gaming</h3>
          <p className="text-sm">
            Sports results, statistics, and real-time game data for betting and gaming platforms.
          </p>
        </div>
        
        <div className="border p-3 rounded-lg">
          <h3 className="text-lg font-semibold">Weather Data</h3>
          <p className="text-sm">
            Current conditions, forecasts, and historical data for weather-dependent applications.
          </p>
        </div>
        
        <div className="border p-3 rounded-lg">
          <h3 className="text-lg font-semibold">IoT Integration</h3>
          <p className="text-sm">
            Data from IoT sensors and devices to trigger smart contract actions.
          </p>
        </div>
        
        <div className="border p-3 rounded-lg">
          <h3 className="text-lg font-semibold">Social Media</h3>
          <p className="text-sm">
            Monitor for specific events, mentions, or trends on social platforms.
          </p>
        </div>
        
        <div className="border p-3 rounded-lg">
          <h3 className="text-lg font-semibold">Supply Chain</h3>
          <p className="text-sm">
            Track and verify shipments, inventory levels, and logistics information.
          </p>
        </div>
      </div>
      
      <h2>Monitoring and Metrics</h2>
      
      <p>The service provides comprehensive monitoring capabilities:</p>
      
      <ul>
        <li>Request volume and success rate by data source</li>
        <li>Response time for external APIs</li>
        <li>Data validation success rates</li>
        <li>Gas usage for on-chain operations</li>
        <li>Error rates by source and type</li>
        <li>Request distribution by client</li>
      </ul>
      
      <p>
        These metrics are exposed via Prometheus endpoints and can be visualized using Grafana dashboards.
      </p>
      
      <h2>Example: Creating a Price Oracle</h2>
      
      <p>
        Let's create a simple price oracle that fetches Neo token price from CoinGecko and reports it to a smart contract:
      </p>
      
      <h3>1. Create an Oracle Definition</h3>
      
      <CodeBlock
        language="json"
        code={`{
  "name": "NeoPriceOracle",
  "description": "Neo/USD price oracle using CoinGecko API",
  "source": {
    "type": "rest",
    "url": "https://api.coingecko.com/api/v3/simple/price?ids=neo&vs_currencies=usd",
    "method": "GET",
    "headers": {
      "Accept": "application/json"
    }
  },
  "extraction": {
    "path": "$.neo.usd",
    "transform": "parseFloat(data) * 100000000" // Convert to integer with 8 decimal places
  },
  "schedule": {
    "type": "interval",
    "interval": 3600 // Update hourly
  },
  "delivery": {
    "contract_hash": "0x1234567890abcdef1234567890abcdef12345678",
    "method": "UpdatePrice",
    "gas": 1.0
  }
}`}
      />
      
      <h3>2. Create a Consumer Smart Contract</h3>
      
      <CodeBlock
        language="go"
        code={`using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;
using System;
using System.ComponentModel;

namespace NeoPriceConsumer
{
    [DisplayName("PriceConsumer")]
    [ManifestExtra("Author", "Neo Service Layer")]
    [ManifestExtra("Description", "Sample Oracle Price Consumer")]
    public class PriceConsumer : SmartContract
    {
        // Price storage key
        private static readonly StorageKey PriceKey = new StorageKey("price");
        
        // Notification event when price is updated
        [DisplayName("PriceUpdated")]
        public static event Action<BigInteger> OnPriceUpdated;
        
        // Method called by the Oracle Service
        public static void UpdatePrice(BigInteger price)
        {
            // Only allow the Oracle Service to call this method
            if (!Runtime.CheckWitness(Oracle.OracleAddress))
                throw new Exception("Unauthorized caller");
                
            // Store the price
            Storage.Put(PriceKey, price);
            
            // Emit event
            OnPriceUpdated(price);
        }
        
        // Get the current price
        public static BigInteger GetPrice()
        {
            return (BigInteger)Storage.Get(PriceKey);
        }
    }
}`}
      />
      
      <h3>3. Query the Oracle Data</h3>
      
      <p>
        Once the oracle is set up and reporting data to your contract, you can query the data:
      </p>
      
      <CodeBlock
        language="javascript"
        code={`// Using Neo SDK to call the consumer contract
const { rpc, sc } = require('@cityofzion/neon-js');

const rpcClient = new rpc.RPCClient('https://n3seed1.ngd.network:10332');
const scriptHash = '0x1234567890abcdef1234567890abcdef12345678'; // Your contract hash

async function getNeoPrice() {
  const result = await rpcClient.invokeFunction(scriptHash, 'GetPrice');
  
  if (result.state === 'HALT') {
    const price = parseInt(result.stack[0].value) / 100000000; // Convert back to decimal
    console.log(\`Current Neo price: $\${price.toFixed(2)}\`);
    return price;
  } else {
    console.error('Failed to get price:', result);
    return null;
  }
}

getNeoPrice();`}
      />
      
      <h2>Advanced Features</h2>
      
      <h3>Multi-Source Oracles</h3>
      
      <p>
        For critical data points, you can create multi-source oracles that aggregate data from multiple providers:
      </p>
      
      <CodeBlock
        language="json"
        code={`{
  "name": "Neo Multi-Source Price Oracle",
  "sources": [
    {
      "name": "CoinGecko",
      "url": "https://api.coingecko.com/api/v3/simple/price?ids=neo&vs_currencies=usd",
      "path": "$.neo.usd",
      "weight": 1.0
    },
    {
      "name": "Binance",
      "url": "https://api.binance.com/api/v3/ticker/price?symbol=NEOUSDT",
      "path": "$.price",
      "weight": 1.0
    },
    {
      "name": "Huobi",
      "url": "https://api.huobi.pro/market/detail/merged?symbol=neousdt",
      "path": "$.tick.close",
      "weight": 1.0
    }
  ],
  "aggregation": "median", // Options: mean, median, mode, weighted_average
  "filtering": {
    "outlier_threshold": 3.0, // Standard deviations for outlier detection
    "min_sources": 2 // Minimum sources needed for a valid result
  }
}`}
      />
      
      <h3>Custom Data Transformations</h3>
      
      <p>
        You can use JavaScript transformations to process data before it's sent to the blockchain:
      </p>
      
      <CodeBlock
        language="javascript"
        code={`// Example transformation function
function transform(data) {
  // Convert string to float
  const price = parseFloat(data);
  
  // Apply scaling factor for integer representation (8 decimal places)
  const scaledPrice = Math.round(price * 100000000);
  
  // Validate the result
  if (isNaN(scaledPrice) || scaledPrice <= 0) {
    throw new Error('Invalid price data');
  }
  
  return scaledPrice;
}`}
      />
      
      <h2>Security Considerations</h2>
      
      <h3>Data Source Security</h3>
      
      <ul>
        <li>Always use HTTPS endpoints</li>
        <li>Store credentials securely using the Secrets Service</li>
        <li>Implement regular rotation of API keys</li>
        <li>Monitor for unusual access patterns</li>
      </ul>
      
      <h3>On-chain Security</h3>
      
      <ul>
        <li>Implement data validity checks in your contract</li>
        <li>Use rate limiting for updates</li>
        <li>Verify the Oracle Service signature</li>
        <li>Set appropriate gas limits</li>
      </ul>
      
      <h2>API Reference</h2>
      <p>
        For a complete API reference, see the <Link href="/docs/api/oracle-api" className="text-primary hover:underline">Oracle API Documentation</Link>.
      </p>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/guides/oracle-guide" className="text-primary hover:underline">Oracle Developer Guide</Link></li>
        <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
        <li><Link href="/docs/services/automation" className="text-primary hover:underline">Automation Service Documentation</Link></li>
        <li><Link href="/playground" className="text-primary hover:underline">Try the Playground</Link></li>
      </ul>
    </div>
  );
}