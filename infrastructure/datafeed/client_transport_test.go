package datafeed

import (
	"crypto/tls"
	"net/http"
	"testing"
	"time"
)

func TestNewClientUsesTLS12Transport(t *testing.T) {
	client, err := NewClient("https://arb1.arbitrum.io/rpc", "arbitrum")
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	if client.httpClient == nil {
		t.Fatal("httpClient = nil")
	}
	if client.httpClient.Timeout != 30*time.Second {
		t.Fatalf("Timeout = %v, want %v", client.httpClient.Timeout, 30*time.Second)
	}

	tr, ok := client.httpClient.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("Transport type = %T, want *http.Transport", client.httpClient.Transport)
	}
	if tr.TLSClientConfig == nil || tr.TLSClientConfig.MinVersion < tls.VersionTLS12 {
		t.Fatal("NewClient() did not enforce TLS 1.2+")
	}
}

func TestNewClientDisablesRedirects(t *testing.T) {
	client, err := NewClient("https://arb1.arbitrum.io/rpc", "arbitrum")
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	if client.httpClient.CheckRedirect == nil {
		t.Fatal("CheckRedirect should be set")
	}
	if err := client.httpClient.CheckRedirect(&http.Request{}, nil); err != http.ErrUseLastResponse {
		t.Fatalf("CheckRedirect() = %v, want %v", err, http.ErrUseLastResponse)
	}
}
