# Price Feed Service

## Overview

The Price Feed Service is a centralized solution for providing reliable token price data to the Neo N3 blockchain. It regularly fetches price data from external sources, validates it, and updates on-chain price feed contracts to make the data available to smart contracts.

## Features

- Regular price updates for supported token pairs
- Multiple external price sources with aggregation for reliability
- Configurable update frequency and deviation thresholds
- Historical price data storage and retrieval
- On-chain price feed contract integration
- Heartbeat functionality to ensure regular updates even without price changes

## Architecture

The Price Feed Service consists of the following components:

1. **Price Fetcher**: Retrieves price data from external sources
2. **Price Aggregator**: Combines and validates price data from multiple sources
3. **Update Scheduler**: Manages the timing of price updates
4. **On-chain Transmitter**: Submits price updates to the blockchain
5. **Storage Layer**: Records price history and service metrics

## Data Flow

1. The Update Scheduler triggers a price update based on configured schedules
2. The Price Fetcher retrieves price data from all configured external sources
3. The Price Aggregator validates and combines the data, applying outlier rejection if needed
4. If the price deviation exceeds the threshold or heartbeat time is reached, an update is triggered
5. The On-chain Transmitter submits the update to the blockchain
6. The Storage Layer records the update for historical reference and auditing

## External Price Sources

The service supports the following price data sources:

- Binance
- CoinGecko
- CoinMarketCap
- Huobi
- OKX

Additional sources can be added through the configuration system.

## Supported Token Pairs

The initial release supports the following token pairs:

- NEO/USD
- GAS/USD
- BTC/USD
- ETH/USD
- FLM/USD

More pairs can be added through configuration.

## Configuration Options

```yaml
price_feed:
  update_interval: 1h             # Default update interval
  deviation_threshold: 0.5        # Price deviation threshold in percentage
  heartbeat_interval: 24h         # Maximum time between updates
  sources:
    - name: binance
      weight: 1.0
      timeout: 5s
    - name: coingecko
      weight: 1.0
      timeout: 5s
  token_pairs:
    - id: neo_usd
      base_token: NEO
      quote_token: USD
      custom_interval: 30m        # Override default interval
      custom_threshold: 0.25      # Override default threshold
      custom_heartbeat: 12h       # Override default heartbeat
```

## API Endpoints

### Admin API

- `GET /api/v1/price-feeds` - List all configured price feeds
- `GET /api/v1/price-feeds/{id}` - Get details for a specific price feed
- `GET /api/v1/price-feeds/{id}/history` - Get price history for a specific feed
- `POST /api/v1/price-feeds` - Create a new price feed configuration
- `PUT /api/v1/price-feeds/{id}` - Update a price feed configuration
- `DELETE /api/v1/price-feeds/{id}` - Delete a price feed configuration
- `POST /api/v1/price-feeds/{id}/trigger-update` - Manually trigger a price update

### Public API

- `GET /api/v1/public/prices` - Get current prices for all feeds
- `GET /api/v1/public/prices/{id}` - Get current price for a specific feed
- `GET /api/v1/public/prices/{id}/history` - Get price history for a specific feed

## Smart Contract Integration

The Price Feed Service interacts with on-chain price feed contracts that implement the standard Neo N3 price feed interface. These contracts store the latest price data and provide access to it for other smart contracts.

### Example Price Feed Contract Interface

```go
// Price feed contract interface (pseudo-code)
type PriceFeedContract interface {
    // Updates the price data
    UpdatePrice(price uint64, timestamp uint64, signature []byte) bool
    
    // Gets the latest price data
    GetLatestPrice() (price uint64, timestamp uint64)
    
    // Gets the latest round data
    GetLatestRoundData() (roundId uint64, price uint64, timestamp uint64)
}
```

## Security Considerations

- All price updates are signed by the service's TEE
- Multiple price sources are used to prevent manipulation
- Outlier detection algorithms reject suspicious price data
- Deviation thresholds prevent erroneous updates
- Heartbeat ensures updates even during stable price periods
- All price updates are logged and auditable

## Performance Considerations

- Price updates are batched to reduce blockchain transactions
- Low-latency connections to external APIs
- Caching of recent price data
- Rate limiting to prevent API abuse
- Failover mechanisms for API outages

## Monitoring and Metrics

The Price Feed Service provides the following metrics:

- Update frequency and success rate
- Price deviation statistics
- External API latency and reliability
- Gas usage for on-chain updates
- Error rates and types

These metrics are exposed via Prometheus and can be visualized in Grafana dashboards. 