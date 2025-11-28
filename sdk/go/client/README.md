# Service Layer Go Client

Typed HTTP client for the Service Layer API with optional Supabase refresh token support.

## Install

```bash
go get github.com/R3E-Network/service_layer/sdk/go/client
```

## Usage

```go
package main

import (
	"context"
	"fmt"
	"time"

	sl "github.com/R3E-Network/service_layer/sdk/go/client"
)

func main() {
	client := sl.New(sl.Config{
		BaseURL:      "http://localhost:8080",
		Token:        "dev-token",              // optional if RefreshToken is set
		RefreshToken: "supabase-refresh-token", // optional; exchanged via /auth/refresh
		TenantID:     "my-tenant",              // sets X-Tenant-ID
		Timeout:      30 * time.Second,         // optional; defaults to 30s
	})

	ctx := context.Background()
	feeds, err := client.PriceFeeds.List(ctx, sl.PaginationParams{Limit: 5})
	if err != nil {
		panic(err)
	}
	fmt.Println("feeds:", feeds)
}
```

### Supabase refresh tokens
- Set `RefreshToken` in `Config` to let the client call `/auth/refresh` automatically when no access token is set or a 401 is returned. This is designed for self-hosted Supabase GoTrue deployments (`SUPABASE_JWT_SECRET` + `SUPABASE_GOTRUE_URL` on the server).
- `Token` is reused once issued; callers can still set `Token` up front if they have a short-lived access token.

### Tenancy
- Multi-tenant deployments require `X-Tenant-ID`. Set `TenantID` in `Config` to automatically send the header for every request.

### Engine bus fan-out
- Use `Bus.PublishEvent` to dispatch an event to all registered modules, `Bus.PushData` for data fan-out, and `Bus.Compute` to invoke every compute engine and collect results.
- Example:

```go
results, err := client.Bus.Compute(ctx, map[string]any{"action": "ping"})
if err != nil {
    panic(err)
}
fmt.Println("compute results:", results)
```
