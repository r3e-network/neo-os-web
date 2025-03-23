"use client";

import Link from 'next/link';
import Image from 'next/image';

export default function OracleServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Oracle Service</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Oracle Service provides a secure bridge between the Neo N3 blockchain and external data sources.
          It enables smart contracts to access real-world data such as market prices, weather information, 
          sports results, and other off-chain data that would otherwise be inaccessible from within the blockchain.
        </p>
      </div>
      
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
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Scheduled Data Feeds</h3>
          <p>
            Set up regular data updates at specified intervals, ensuring your smart
            contracts always have recent data.
          </p>
        </div>
        
        <div className="border p-5 rounded-lg">
          <h3 className="text-xl font-semibold mb-2">Request-Response Model</h3>
          <p>
            Smart contracts can directly request data and receive responses through
            a callback pattern.
          </p>
        </div>
      </div>
      
      <h2>How It Works</h2>
      
      <div className="my-8">
        <h3>Architecture</h3>
        <p>
          The Oracle Service uses a multi-layered architecture to securely deliver external data to smart contracts:
        </p>
        
        <ol className="list-decimal pl-6 space-y-2 mb-6">
          <li>
            <strong>Request Initiation:</strong> A smart contract emits an event with the data request details,
            or a scheduled feed is triggered.
          </li>
          <li>
            <strong>Request Processing:</strong> The Oracle Service picks up the request and processes it
            within the TEE.
          </li>
          <li>
            <strong>Data Fetching:</strong> The service securely connects to the specified external data sources.
          </li>
          <li>
            <strong>Data Validation:</strong> The data is validated using the configured consensus mechanism.
          </li>
          <li>
            <strong>Data Delivery:</strong> The validated data is delivered to the smart contract through a callback.
          </li>
        </ol>
        
        <Image 
          src="/images/docs/oracle-service-flow.png" 
          alt="Oracle Service Flow" 
          width={800} 
          height={400}
          className="my-8 border rounded-lg shadow-md"
          style={{maxWidth: '100%', height: 'auto'}}
        />
      </div>
      
      <h2>Usage Examples</h2>
      
      <div className="my-8">
        <h3>Example 1: Request-Response Pattern</h3>
        <p>
          Smart contract requesting weather data:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// NEO•ONE example of a smart contract requesting weather data
import {
  SmartContract,
  Address,
  createEventNotifier,
  constant,
  Fixed
} from '@neo-one/smart-contract';

interface OracleRequest {
  readonly requestId: string;
  readonly callbackContract: Address;
  readonly callbackMethod: string;
  readonly url: string;
  readonly jsonPath: string;
}

const notifyOracleRequest = createEventNotifier<OracleRequest>(
  'OracleRequest'
);

export class WeatherContract extends SmartContract {
  private readonly oracleAddress = Address.from('NScqrHmZG3kjzkZ3W4xJhSNHY4YEY8cVMk');
  private latestTemperature: Fixed<8> = 0;
  private latestHumidity: Fixed<8> = 0;
  private lastUpdated: number = 0;
  
  @constant
  public get temperature(): Fixed<8> {
    return this.latestTemperature;
  }
  
  @constant
  public get humidity(): Fixed<8> {
    return this.latestHumidity;
  }
  
  @constant
  public get lastUpdate(): number {
    return this.lastUpdated;
  }
  
  // Method to request weather data
  public requestWeatherUpdate(city: string): void {
    // Create a unique request ID
    const requestId = this.transaction.hash.toString();
    
    // Create the Oracle request
    notifyOracleRequest({
      requestId,
      callbackContract: this.address,
      callbackMethod: 'processWeatherData',
      url: \`https://api.weather.example.com/current?city=\${city}\`,
      jsonPath: '$.current'
    });
  }
  
  // Callback method that will be invoked by the oracle service
  public processWeatherData(
    requestId: string, 
    temperature: Fixed<8>, 
    humidity: Fixed<8>
  ): void {
    // Ensure caller is the oracle
    if (!this.transaction.sender.equals(this.oracleAddress)) {
      throw new Error('Unauthorized caller');
    }
    
    // Update the contract state with the new weather data
    this.latestTemperature = temperature;
    this.latestHumidity = humidity;
    this.lastUpdated = this.block.index;
  }
}`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Example 2: Setting Up a Regular Data Feed</h3>
        <p>
          Creating a scheduled data feed using the API:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using the Neo Service Layer SDK
import { OracleService } from 'neo-service-layer-sdk';

// Initialize the Oracle service with your API key
const oracleService = new OracleService({
  apiKey: 'your-api-key'
});

// Create a regular price feed for NEO/USD
const feed = await oracleService.createDataFeed({
  name: 'NEO/USD Price Feed',
  schedule: '*/15 * * * *',  // Every 15 minutes
  source: {
    type: 'rest',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=neo&vs_currencies=usd',
    method: 'GET'
  },
  transformation: {
    type: 'jsonPath',
    path: '$.neo.usd',
    // Optional post-processing
    process: 'value => Math.round(value * 100)'
  },
  destination: {
    type: 'contract',
    network: 'MainNet',
    scriptHash: '0xd7c6e3d8a8a89e491ea55a10d2104b2d23e99079',
    operation: 'updatePrice',
    // Arguments to pass to the contract method (will append the data value automatically)
    args: [
      { type: 'String', value: 'NEO' },
      { type: 'String', value: 'USD' }
    ]
  }
});

console.log('Data feed created:', feed.id);
`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Example 3: Multi-Source Data with Consensus</h3>
        <p>
          Create an oracle feed with multiple data sources and consensus validation:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// JavaScript example using the Neo Service Layer SDK
import { OracleService } from 'neo-service-layer-sdk';

// Initialize the Oracle service with your API key
const oracleService = new OracleService({
  apiKey: 'your-api-key'
});

// Create a feed that aggregates price data from multiple sources
const feed = await oracleService.createDataFeed({
  name: 'BTC/USD Aggregated Price Feed',
  schedule: '*/5 * * * *',  // Every 5 minutes
  
  // Multiple data sources
  sources: [
    {
      id: 'coinbase',
      type: 'rest',
      url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
      method: 'GET',
      transformation: {
        type: 'jsonPath',
        path: '$.data.amount',
        process: 'parseFloat'
      }
    },
    {
      id: 'binance',
      type: 'rest',
      url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
      method: 'GET',
      transformation: {
        type: 'jsonPath',
        path: '$.price',
        process: 'parseFloat'
      }
    },
    {
      id: 'kraken',
      type: 'rest',
      url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
      method: 'GET',
      transformation: {
        type: 'jsonPath',
        path: '$.result.XXBTZUSD.c[0]',
        process: 'parseFloat'
      }
    }
  ],
  
  // Consensus configuration for the data sources
  consensus: {
    type: 'median',    // Use median value across sources
    minSources: 2,     // Require at least 2 sources to report
    maxDeviation: 0.01 // Max 1% deviation from median
  },
  
  destination: {
    type: 'contract',
    network: 'MainNet',
    scriptHash: '0xd7c6e3d8a8a89e491ea55a10d2104b2d23e99079',
    operation: 'updatePrice',
    args: [
      { type: 'String', value: 'BTC' },
      { type: 'String', value: 'USD' }
    ]
  }
});

console.log('Multi-source feed created:', feed.id);
`}</pre>
      </div>
      
      <h2>Data Transformations</h2>
      
      <div className="my-8">
        <p>
          The Oracle Service supports various data transformation techniques to process the raw data
          before it is delivered to smart contracts:
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Transformation Type</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Example</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">JSONPath</td>
                <td className="border border-gray-300 px-4 py-2">Extract specific values from JSON responses</td>
                <td className="border border-gray-300 px-4 py-2"><code>$.data.price</code></td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">XPath</td>
                <td className="border border-gray-300 px-4 py-2">Extract values from XML responses</td>
                <td className="border border-gray-300 px-4 py-2"><code>//price/text()</code></td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Regex</td>
                <td className="border border-gray-300 px-4 py-2">Extract values using regular expressions</td>
                <td className="border border-gray-300 px-4 py-2"><code>price: ([0-9.]+)</code></td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">JavaScript</td>
                <td className="border border-gray-300 px-4 py-2">Use custom JavaScript code to transform data</td>
                <td className="border border-gray-300 px-4 py-2"><code>data =&gt; Math.round(data * 100)</code></td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Aggregation</td>
                <td className="border border-gray-300 px-4 py-2">Aggregate values from multiple sources</td>
                <td className="border border-gray-300 px-4 py-2"><code>median, average, min, max</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <h2>Consensus Mechanisms</h2>
      
      <div className="my-8">
        <p>
          The Oracle Service offers several consensus mechanisms to ensure data reliability:
        </p>
        
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Single Source:</strong> Data from a single trusted source, protected by TEE.
          </li>
          <li>
            <strong>Majority Vote:</strong> Multiple sources fetch the same data, and the majority value is used.
          </li>
          <li>
            <strong>Median/Mean:</strong> The median or mean value across multiple data sources is used.
          </li>
          <li>
            <strong>Threshold Signature:</strong> Multiple parties sign the data, requiring a minimum threshold of signatures.
          </li>
          <li>
            <strong>Custom Consensus:</strong> Implement custom consensus logic using JavaScript functions.
          </li>
        </ul>
      </div>
      
      <h2>Security Considerations</h2>
      
      <div className="my-8">
        <h3>Trusted Data Sources</h3>
        <p>
          When setting up oracle feeds, consider these best practices:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Use reputable and reliable data providers</li>
          <li>Implement multiple data sources when possible</li>
          <li>Set appropriate timeouts for data fetching</li>
          <li>Monitor source reliability and response patterns</li>
        </ul>
        
        <h3>Smart Contract Security</h3>
        <p>
          When consuming oracle data in your smart contracts:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Always verify the caller is the trusted oracle address</li>
          <li>Implement data sanitization and validation</li>
          <li>Use appropriate data types for the received values</li>
          <li>Consider implementing time-based staleness checks</li>
          <li>Have fallback mechanisms for oracle failures</li>
        </ul>
        
        <h3>TEE Protection</h3>
        <p>
          Our Oracle Service uses Azure Confidential Computing to provide TEE protection:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Data processing occurs in isolated memory enclaves</li>
          <li>Oracle code and data are protected from tampering</li>
          <li>Remote attestation verifies the integrity of the TEE</li>
          <li>Encryption keys are managed securely within the TEE</li>
        </ul>
      </div>
      
      <h2>Integration with Other Services</h2>
      
      <div className="my-8">
        <h3>Functions Service</h3>
        <p>
          You can use the Oracle Service within your Functions:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// Example function that uses the Oracle Service
module.exports = async function(context) {
  // Access the oracle service from the context
  const { oracle } = context.services;
  
  // Fetch data from an external API
  const weatherData = await oracle.fetch({
    url: 'https://api.weather.example.com/current?city=new-york',
    method: 'GET',
    jsonPath: '$.current'
  });
  
  // Process the data
  const temperature = weatherData.temperature;
  const humidity = weatherData.humidity;
  
  // Return processed data
  return {
    temperature,
    humidity,
    timestamp: new Date().toISOString()
  };
};`}</pre>
      </div>
      
      <div className="my-8">
        <h3>Automation Service</h3>
        <p>
          You can trigger automations based on oracle data:
        </p>
        
        <pre className="bg-gray-100 p-4 rounded-md">
{`// Example automation configuration with oracle data
{
  "triggers": [
    {
      "type": "oracle",
      "configuration": {
        "dataFeedId": "btc-usd-price-feed",
        "condition": "value > 50000" // Trigger when BTC price > $50,000
      }
    }
  ],
  "action": {
    "type": "contract",
    "configuration": {
      "scriptHash": "0x7a16a1f5c40e69790333f3bfe7e4325a08cc2f79",
      "operation": "triggerBuyOrder",
      "args": [
        { "type": "String", "value": "BTC" },
        { "type": "Integer", "value": "100000000" } // 1 BTC in smallest units
      ]
    }
  }
}`}</pre>
      </div>
      
      <h2>API Reference</h2>
      
      <div className="my-8">
        <p>
          For a complete API reference, see the <Link href="/docs/api/oracle-api" className="text-primary hover:underline">Oracle Service API documentation</Link>.
        </p>
        
        <h3>Key Endpoints</h3>
        <ul className="list-disc pl-6 space-y-2">
          <li><code>POST /v1/oracle/feeds</code> - Create a new data feed</li>
          <li><code>GET /v1/oracle/feeds</code> - List all your data feeds</li>
          <li><code>GET /v1/oracle/feeds/{'{id}'}</code> - Get details of a specific data feed</li>
          <li><code>PUT /v1/oracle/feeds/{'{id}'}</code> - Update a data feed</li>
          <li><code>DELETE /v1/oracle/feeds/{'{id}'}</code> - Delete a data feed</li>
          <li><code>POST /v1/oracle/fetch</code> - Fetch data from an external source</li>
          <li><code>GET /v1/oracle/history</code> - View historical oracle data</li>
        </ul>
      </div>
      
      <h2>Pricing</h2>
      
      <div className="my-8">
        <p>
          The Oracle Service is priced based on the number of data requests and feeds:
        </p>
        
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Plan</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Features</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Free Tier</td>
                <td className="border border-gray-300 px-4 py-2">
                  <ul className="list-disc pl-6">
                    <li>Up to 1,000 requests / month</li>
                    <li>Up to 5 data feeds</li>
                    <li>Single data source per feed</li>
                  </ul>
                </td>
                <td className="border border-gray-300 px-4 py-2">Free</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">Standard</td>
                <td className="border border-gray-300 px-4 py-2">
                  <ul className="list-disc pl-6">
                    <li>Up to 100,000 requests / month</li>
                    <li>Up to 50 data feeds</li>
                    <li>Multiple data sources with consensus</li>
                    <li>Custom transformations</li>
                  </ul>
                </td>
                <td className="border border-gray-300 px-4 py-2">0.01 GAS per request</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2">Enterprise</td>
                <td className="border border-gray-300 px-4 py-2">
                  <ul className="list-disc pl-6">
                    <li>Unlimited requests</li>
                    <li>Unlimited data feeds</li>
                    <li>Advanced consensus mechanisms</li>
                    <li>Premium data sources</li>
                    <li>Dedicated support</li>
                  </ul>
                </td>
                <td className="border border-gray-300 px-4 py-2">Custom pricing</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <p className="mt-4">
          See the <Link href="/pricing" className="text-primary hover:underline">Pricing page</Link> for more details.
        </p>
      </div>
      
      <h2>Next Steps</h2>
      
      <div className="mt-8 space-y-6">
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Examples</h3>
          <p className="mb-2">
            Explore complete examples of oracle data feeds in different scenarios.
          </p>
          <Link href="/docs/examples/oracle" className="text-primary hover:underline">
            View examples →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">API Documentation</h3>
          <p className="mb-2">
            View the complete API reference for the Oracle Service.
          </p>
          <Link href="/docs/api/oracle-api" className="text-primary hover:underline">
            View API documentation →
          </Link>
        </div>
        
        <div className="border-l-4 border-primary pl-4 py-1">
          <h3 className="text-lg font-semibold mb-1">Integration Tutorials</h3>
          <p className="mb-2">
            Follow step-by-step tutorials for integrating oracle data in your applications.
          </p>
          <Link href="/docs/tutorials/oracle-integration" className="text-primary hover:underline">
            View tutorials →
          </Link>
        </div>
      </div>
    </div>
  );
} 