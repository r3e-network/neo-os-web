"use client";

import Link from 'next/link';

export default function PriceFeedServiceDocs() {
  return (
    <div className="prose prose-lg max-w-none">
      <h1>Price Feed Service</h1>
      
      <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-400">
        <h2 className="text-xl font-semibold text-blue-800 mt-0">Overview</h2>
        <p className="mb-0">
          The Price Feed Service provides reliable, tamper-resistant price data for cryptocurrencies, traditional assets, 
          and other financial instruments on the Neo N3 blockchain. This service enables DeFi applications to access
          accurate price information for critical operations such as lending, trading, and collateralization.
        </p>
      </div>
      
      <h2>Key Features</h2>
      <ul>
        <li>Real-time price data for a wide range of assets</li>
        <li>Multiple price data sources for increased reliability</li>
        <li>Aggregation mechanisms to prevent manipulation</li>
        <li>Configurable update frequency</li>
        <li>On-chain verification of price data</li>
        <li>Historical price data access</li>
        <li>Low-latency data delivery</li>
        <li>Support for custom price pairs</li>
      </ul>
      
      <h2>Supported Assets</h2>
      <p>
        The Price Feed Service supports a wide range of asset pairs, including:
      </p>
      
      <h3>Cryptocurrencies</h3>
      <ul>
        <li>NEO/USD</li>
        <li>GAS/USD</li>
        <li>BTC/USD</li>
        <li>ETH/USD</li>
        <li>NEO/BTC</li>
        <li>NEO/ETH</li>
        <li>And many other popular trading pairs</li>
      </ul>
      
      <h3>Fiat Currencies</h3>
      <ul>
        <li>USD/EUR</li>
        <li>USD/JPY</li>
        <li>USD/GBP</li>
        <li>And other major forex pairs</li>
      </ul>
      
      <h3>Commodities</h3>
      <ul>
        <li>XAU/USD (Gold)</li>
        <li>XAG/USD (Silver)</li>
        <li>And other major commodities</li>
      </ul>
      
      <p>
        For a complete list of supported assets, check the <Link href="/docs/api/price-feed-api" className="text-primary hover:underline">Price Feed API documentation</Link>.
      </p>
      
      <h2>How It Works</h2>
      <p>
        The Price Feed Service follows a rigorous process to ensure accuracy and reliability:
      </p>
      
      <ol>
        <li><strong>Data Collection:</strong> Price data is collected from multiple reputable sources including major exchanges, data providers, and aggregators.</li>
        <li><strong>Data Validation:</strong> Each data point is validated for accuracy, timeliness, and reliability.</li>
        <li><strong>Aggregation:</strong> Multiple price points are aggregated using a volume-weighted median algorithm to filter out outliers and prevent manipulation.</li>
        <li><strong>TEE Processing:</strong> Data processing occurs in a Trusted Execution Environment (TEE) to ensure integrity.</li>
        <li><strong>On-chain Publication:</strong> The validated price data is published to on-chain contracts where it can be accessed by other smart contracts.</li>
        <li><strong>Verification:</strong> Each price update includes verification data that confirms its source and processing integrity.</li>
      </ol>
      
      <div className="bg-primary/10 p-6 rounded-lg my-8 border-l-4 border-primary">
        <h3 className="text-xl font-semibold text-primary-dark mt-0">Data Quality Assurance</h3>
        <p className="mb-0">
          Our Price Feed Service implements several mechanisms to ensure data quality:
        </p>
        <ul className="mb-0">
          <li>Minimum number of data points required for each update</li>
          <li>Maximum deviation thresholds to detect unusual price movements</li>
          <li>Heartbeat updates to ensure data freshness even when prices are stable</li>
          <li>Source credibility scoring to weight more reliable sources higher</li>
        </ul>
      </div>
      
      <h2>Accessing Price Data</h2>
      <p>
        Price data can be accessed in several ways:
      </p>
      
      <h3>On-chain Access</h3>
      <p>
        Smart contracts can directly read price data from the Price Feed contracts:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`// Example of how a Neo N3 smart contract would access price data
// This is pseudocode for illustration purposes

public static object GetNeoPrice()
{
    // Get the Price Feed contract
    UInt160 priceFeedContract = "0xe8f984de846c9a6a32c78755b95eb918acd7b2a4".ToScriptHash();
    
    // Call the getPrice method with the asset pair
    object[] args = new object[] { "NEO/USD" };
    var result = (BigInteger)Contract.Call(priceFeedContract, "getPrice", CallFlags.ReadOnly, args);
    
    // Price is returned as an integer with 8 decimal places
    // e.g., 1234567890 represents $12.34567890
    return result;
}

// Example of getting the last update timestamp
public static object GetLastUpdateTime()
{
    UInt160 priceFeedContract = "0xe8f984de846c9a6a32c78755b95eb918acd7b2a4".ToScriptHash();
    
    object[] args = new object[] { "NEO/USD" };
    var result = (BigInteger)Contract.Call(priceFeedContract, "getLastUpdateTime", CallFlags.ReadOnly, args);
    
    // Returns a timestamp in Unix epoch format
    return result;
}`}
      </pre>
      
      <h3>API Access</h3>
      <p>
        For off-chain applications, price data can be accessed through the REST API:
      </p>
      
      <h4>Request</h4>
      <pre className="bg-gray-100 p-4 rounded-md">
{`GET https://api.neo-service-layer.com/v1/price-feed/pairs/NEO-USD`}
      </pre>
      
      <h4>Response</h4>
      <pre className="bg-gray-100 p-4 rounded-md">
{`{
  "pair": "NEO-USD",
  "price": "12.34567890",
  "decimals": 8,
  "lastUpdateTime": 1679523600,
  "sources": ["binance", "huobi", "okx", "gate"],
  "confidence": 0.98,
  "deviation": 0.0025
}`}
      </pre>
      
      <h3>JavaScript Functions</h3>
      <p>
        You can also access price data from within JavaScript functions:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`async function main(args) {
  // Get current NEO price
  const neoPrice = neo.getPrice("NEO/USD");
  
  // Get historical NEO price
  const historicalPrice = neo.getHistoricalPrice({
    pair: "NEO/USD",
    timestamp: new Date("2023-03-15").getTime() / 1000
  });
  
  // Get multiple prices at once
  const prices = await neo.getPrices(["NEO/USD", "GAS/USD", "BTC/USD"]);
  
  return {
    currentNeoPrice: neoPrice,
    historicalNeoPrice: historicalPrice,
    allPrices: prices,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h2>Use Cases</h2>
      
      <h3>DeFi Applications</h3>
      <ul>
        <li><strong>Lending Protocols:</strong> Determine collateralization ratios and liquidation thresholds</li>
        <li><strong>DEXs:</strong> Provide reference prices for trading</li>
        <li><strong>Derivatives:</strong> Create price-based financial instruments</li>
        <li><strong>Stablecoins:</strong> Maintain pegs to fiat currencies</li>
      </ul>
      
      <h3>Smart Contracts</h3>
      <ul>
        <li><strong>Escrow Services:</strong> Release funds based on market conditions</li>
        <li><strong>Parametric Insurance:</strong> Trigger payouts based on price thresholds</li>
        <li><strong>Decentralized Options:</strong> Settle contracts at expiration</li>
      </ul>
      
      <h3>Business Logic</h3>
      <ul>
        <li><strong>Treasury Management:</strong> Automate portfolio rebalancing</li>
        <li><strong>Risk Assessment:</strong> Monitor asset volatility</li>
        <li><strong>Financial Reporting:</strong> Calculate asset values in fiat terms</li>
      </ul>
      
      <h2>Technical Example: Liquidation Protection System</h2>
      <p>
        The following example demonstrates a function that monitors a collateralized position and takes protective action if it approaches liquidation:
      </p>
      
      <pre className="bg-gray-100 p-4 rounded-md">
{`async function main(args) {
  const { address, loanId, warningThreshold, actionThreshold } = args;
  
  // Get loan details (simulated contract call)
  const loanContract = "0x8c34578c30b7e1d148c6c5f2ddb75c812e6f1991";
  const loan = neo.call({
    scriptHash: loanContract,
    operation: "getLoan",
    args: [loanId]
  });
  
  // Get current NEO price
  const neoPrice = neo.getPrice("NEO/USD");
  
  // Calculate current collateral ratio
  const collateralValueUSD = loan.collateralAmount * neoPrice;
  const loanValueUSD = loan.loanAmount;
  const collateralRatio = collateralValueUSD / loanValueUSD;
  
  // Determine if action is needed
  let actionTaken = false;
  let actionType = null;
  
  if (collateralRatio <= actionThreshold) {
    // Execute protective action by adding collateral or partially repaying the loan
    actionType = "protective_action";
    
    // In a real implementation, this would call a contract to add collateral
    // or repay part of the loan to increase the collateral ratio
    
    actionTaken = true;
  } else if (collateralRatio <= warningThreshold) {
    // Send a warning notification
    actionType = "warning";
    
    // In a real implementation, this might trigger a notification
    // through an external system
    
    actionTaken = true;
  }
  
  return {
    address,
    loanId,
    currentPrice: neoPrice,
    collateralAmount: loan.collateralAmount,
    loanAmount: loan.loanValueUSD,
    collateralRatio,
    warningThreshold,
    actionThreshold,
    actionTaken,
    actionType,
    timestamp: new Date().toISOString()
  };
}`}
      </pre>
      
      <h2>Service Guarantees</h2>
      <ul>
        <li><strong>Update Frequency:</strong> Price data is updated at least every 60 seconds for major assets</li>
        <li><strong>Deviation Triggers:</strong> Price updates are also triggered when prices move beyond a threshold (e.g., 0.5%)</li>
        <li><strong>Heartbeat Updates:</strong> Even when prices are stable, updates occur to confirm data freshness</li>
        <li><strong>Data Availability:</strong> 99.9% uptime for price feed services</li>
        <li><strong>Historical Data:</strong> Access to price history for at least 90 days</li>
      </ul>
      
      <h2>API Reference</h2>
      <p>
        For a complete API reference, see the <Link href="/docs/api/price-feed-api" className="text-primary hover:underline">Price Feed API documentation</Link>.
      </p>
      
      <h2>Next Steps</h2>
      <ul>
        <li><Link href="/docs/guides/price-feed-guide" className="text-primary hover:underline">Price Feed Integration Guide</Link></li>
        <li><Link href="/docs/services/oracle" className="text-primary hover:underline">Oracle Service Documentation</Link></li>
        <li><Link href="/docs/services/functions" className="text-primary hover:underline">Functions Service Documentation</Link></li>
        <li><Link href="/playground" className="text-primary hover:underline">Try the Price Feed in the Playground</Link></li>
      </ul>
    </div>
  );
} 