# Go SDK

> Official Go SDK for the Neo Service Layer

## Overview

The Go SDK provides idiomatic Go interfaces for backend integrations.

| Feature          | Description                  |
| ---------------- | ---------------------------- |
| **Context**      | Full context.Context support |
| **Concurrency**  | Goroutine-safe client        |
| **Streaming**    | Channel-based subscriptions  |
| **Typed Errors** | Structured error handling    |

## Requirements

- Go 1.21+
- Module-enabled project

## Installation

```bash
go get github.com/neo-project/service-layer-go
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    neo "github.com/neo-project/service-layer-go"
)

func main() {
    client := neo.NewClient("YOUR_API_KEY")

    // Get price feed
    price, err := client.DataFeed.GetPrice(context.Background(), "GAS-USD")
    if err != nil {
        panic(err)
    }
    fmt.Printf("GAS Price: %s\n", price.Value)
}
```

## Configuration

```go
client := neo.NewClient("YOUR_API_KEY",
    neo.WithBaseURL("https://testnet-api.neo.org/v1"),
    neo.WithTimeout(30 * time.Second),
    neo.WithRetries(3),
)
```

## Services

### DataFeed

```go
// Get single price
price, _ := client.DataFeed.GetPrice(ctx, "GAS-USD")

// List all feeds
feeds, _ := client.DataFeed.ListFeeds(ctx)

// Subscribe to updates
ch := client.DataFeed.Subscribe(ctx, "GAS-USD")
for update := range ch {
    fmt.Printf("New price: %s\n", update.Value)
}
```

### VRF (Randomness)

```go
// Request random number
result, _ := client.VRF.RequestRandom(ctx, &neo.RandomRequest{
    Min: 1,
    Max: 100,
})

// Get result by ID
random, _ := client.VRF.GetResult(ctx, result.ID)
```

### Payments

```go
// Send GAS payment
tx, _ := client.Payments.SendGAS(ctx, &neo.PaymentRequest{
    To:     "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    Amount: "1.5",
})

// Check status
status, _ := client.Payments.GetStatus(ctx, tx.ID)
```

### Governance

```go
// Get council members
members, _ := client.Governance.GetMembers(ctx)

// Vote for candidate
_, _ = client.Governance.Vote(ctx, &neo.VoteRequest{
    Candidate: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    Amount:    100,
})
```

### Secrets

```go
// Store secret
_, _ = client.Secrets.Store(ctx, &neo.SecretRequest{
    Key:   "api-key",
    Value: "sk_live_xxx",
})

// Get secret
secret, _ := client.Secrets.Get(ctx, "api-key")
```

## Error Handling

```go
price, err := client.DataFeed.GetPrice(ctx, "INVALID")
if err != nil {
    var apiErr *neo.APIError
    if errors.As(err, &apiErr) {
        fmt.Printf("Code: %d, Message: %s\n", apiErr.Code, apiErr.Message)
    }
}
```

## Context & Cancellation

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

price, err := client.DataFeed.GetPrice(ctx, "GAS-USD")
```

## Next Steps

- [Python SDK](./Python-SDK.md)
- [CLI Tool](./CLI-Tool.md)
