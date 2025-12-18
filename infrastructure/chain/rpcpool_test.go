package chain

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestNewRPCPool(t *testing.T) {
	tests := []struct {
		name    string
		cfg     *RPCPoolConfig
		wantErr bool
	}{
		{
			name: "valid config",
			cfg: &RPCPoolConfig{
				Endpoints: []string{"http://localhost:10332"},
			},
			wantErr: false,
		},
		{
			name:    "nil config uses defaults",
			cfg:     nil,
			wantErr: true, // No endpoints
		},
		{
			name: "empty endpoints",
			cfg: &RPCPoolConfig{
				Endpoints: []string{},
			},
			wantErr: true,
		},
		{
			name: "multiple endpoints",
			cfg: &RPCPoolConfig{
				Endpoints: []string{"http://node1:10332", "http://node2:10332"},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pool, err := NewRPCPool(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewRPCPool() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && pool == nil {
				t.Error("NewRPCPool() returned nil pool without error")
			}
		})
	}
}

func TestParseEndpoints(t *testing.T) {
	tests := []struct {
		name     string
		csv      string
		expected []string
	}{
		{
			name:     "single endpoint",
			csv:      "http://localhost:10332",
			expected: []string{"http://localhost:10332"},
		},
		{
			name:     "multiple endpoints",
			csv:      "http://node1:10332,http://node2:10332",
			expected: []string{"http://node1:10332", "http://node2:10332"},
		},
		{
			name:     "with spaces",
			csv:      " http://node1:10332 , http://node2:10332 ",
			expected: []string{"http://node1:10332", "http://node2:10332"},
		},
		{
			name:     "empty string",
			csv:      "",
			expected: nil,
		},
		{
			name:     "empty parts filtered",
			csv:      "http://node1:10332,,http://node2:10332",
			expected: []string{"http://node1:10332", "http://node2:10332"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ParseEndpoints(tt.csv)
			if len(result) != len(tt.expected) {
				t.Errorf("ParseEndpoints() = %v, want %v", result, tt.expected)
				return
			}
			for i, v := range result {
				if v != tt.expected[i] {
					t.Errorf("ParseEndpoints()[%d] = %v, want %v", i, v, tt.expected[i])
				}
			}
		})
	}
}

func TestRPCPoolGetBestEndpoint(t *testing.T) {
	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints: []string{"http://node1:10332", "http://node2:10332"},
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	ep, err := pool.GetBestEndpoint()
	if err != nil {
		t.Errorf("GetBestEndpoint() error = %v", err)
	}
	if ep == nil {
		t.Error("GetBestEndpoint() returned nil")
	}
}

func TestRPCPoolGetNextEndpoint(t *testing.T) {
	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints: []string{"http://node1:10332", "http://node2:10332"},
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	ep1 := pool.GetNextEndpoint()
	ep2 := pool.GetNextEndpoint()

	if ep1 == nil || ep2 == nil {
		t.Fatal("GetNextEndpoint() returned nil")
	}

	// Should round-robin
	if ep1.URL == ep2.URL {
		t.Error("GetNextEndpoint() should round-robin between endpoints")
	}
}

func TestRPCPoolMarkUnhealthy(t *testing.T) {
	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints:           []string{"http://node1:10332"},
		MaxConsecutiveFails: 2,
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	// Initially healthy
	if pool.HealthyCount() != 1 {
		t.Errorf("HealthyCount() = %d, want 1", pool.HealthyCount())
	}

	// Mark unhealthy once - should still be healthy
	pool.MarkUnhealthy("http://node1:10332")
	if pool.HealthyCount() != 1 {
		t.Errorf("HealthyCount() after 1 fail = %d, want 1", pool.HealthyCount())
	}

	// Mark unhealthy again - should now be unhealthy
	pool.MarkUnhealthy("http://node1:10332")
	if pool.HealthyCount() != 0 {
		t.Errorf("HealthyCount() after 2 fails = %d, want 0", pool.HealthyCount())
	}
}

func TestRPCPoolMarkHealthy(t *testing.T) {
	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints:           []string{"http://node1:10332"},
		MaxConsecutiveFails: 1,
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	// Mark unhealthy
	pool.MarkUnhealthy("http://node1:10332")
	if pool.HealthyCount() != 0 {
		t.Errorf("HealthyCount() after fail = %d, want 0", pool.HealthyCount())
	}

	// Mark healthy
	pool.MarkHealthy("http://node1:10332", 10*time.Millisecond)
	if pool.HealthyCount() != 1 {
		t.Errorf("HealthyCount() after recovery = %d, want 1", pool.HealthyCount())
	}
}

func TestRPCPoolGetEndpoints(t *testing.T) {
	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints: []string{"http://node1:10332", "http://node2:10332"},
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	endpoints := pool.GetEndpoints()
	if len(endpoints) != 2 {
		t.Errorf("GetEndpoints() length = %d, want 2", len(endpoints))
	}
}

func TestRPCPoolExecuteWithFailover(t *testing.T) {
	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints:           []string{"http://node1:10332", "http://node2:10332"},
		MaxConsecutiveFails: 1,
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	callCount := 0
	err = pool.ExecuteWithFailover(context.Background(), 2, func(url string) error {
		callCount++
		if callCount == 1 {
			return errors.New("first call fails")
		}
		return nil
	})

	if err != nil {
		t.Errorf("ExecuteWithFailover() error = %v", err)
	}
	if callCount != 2 {
		t.Errorf("ExecuteWithFailover() callCount = %d, want 2", callCount)
	}
}

func TestRPCPoolExecuteWithFailoverAllFail(t *testing.T) {
	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints:           []string{"http://node1:10332"},
		MaxConsecutiveFails: 1,
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	err = pool.ExecuteWithFailover(context.Background(), 2, func(url string) error {
		return errors.New("always fails")
	})

	if err == nil {
		t.Error("ExecuteWithFailover() should return error when all retries fail")
	}
}

func TestRPCPoolHealthCheck(t *testing.T) {
	client := &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     http.StatusText(http.StatusOK),
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"jsonrpc":"2.0","id":1,"result":12345}`)),
				Request:    req,
			}, nil
		}),
	}

	pool, err := NewRPCPool(&RPCPoolConfig{
		Endpoints:           []string{"http://example.com"},
		HealthCheckInterval: 10 * time.Millisecond,
		HealthCheckTimeout:  1 * time.Second,
		MaxConsecutiveFails: 3,
		HTTPClient:          client,
	})
	if err != nil {
		t.Fatalf("NewRPCPool() error = %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	pool.Start(ctx)
	time.Sleep(50 * time.Millisecond)
	pool.Stop()

	if pool.HealthyCount() != 1 {
		t.Errorf("HealthyCount() = %d, want 1", pool.HealthyCount())
	}
}

func TestDefaultRPCPoolConfig(t *testing.T) {
	cfg := DefaultRPCPoolConfig()
	if cfg == nil {
		t.Fatal("DefaultRPCPoolConfig() returned nil")
	}
	if cfg.HealthCheckInterval != 30*time.Second {
		t.Errorf("HealthCheckInterval = %v, want 30s", cfg.HealthCheckInterval)
	}
	if cfg.HealthCheckTimeout != 5*time.Second {
		t.Errorf("HealthCheckTimeout = %v, want 5s", cfg.HealthCheckTimeout)
	}
	if cfg.MaxConsecutiveFails != 3 {
		t.Errorf("MaxConsecutiveFails = %d, want 3", cfg.MaxConsecutiveFails)
	}
}
