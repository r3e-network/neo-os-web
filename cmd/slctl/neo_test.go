package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Ensures neo verify-all works with API-relative manifests and multiple heights.
func TestNeoVerifyAll(t *testing.T) {
	kvPayload := []byte("kv-data")
	kvHash := sha256.Sum256(kvPayload)
	diffPayload := []byte("diff-data")
	diffHash := sha256.Sum256(diffPayload)

	handler := http.NewServeMux()
	handler.HandleFunc("/neo/snapshots/10", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"network":"mainnet",
			"height":10,
			"state_root":"root-10",
			"kv_url":"/kv/10",
			"kv_sha256":"` + hex.EncodeToString(kvHash[:]) + `",
			"kv_diff_url":"/kv-diff/10",
			"kv_diff_sha256":"` + hex.EncodeToString(diffHash[:]) + `"
		}`))
	})
	handler.HandleFunc("/neo/snapshots/11", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"network":"mainnet",
			"height":11,
			"state_root":"root-11",
			"kv_url":"/kv/11",
			"kv_sha256":"` + hex.EncodeToString(kvHash[:]) + `"
		}`))
	})
	handler.HandleFunc("/kv/10", func(w http.ResponseWriter, r *http.Request) {
		w.Write(kvPayload)
	})
	handler.HandleFunc("/kv/11", func(w http.ResponseWriter, r *http.Request) {
		w.Write(kvPayload)
	})
	handler.HandleFunc("/kv-diff/10", func(w http.ResponseWriter, r *http.Request) {
		w.Write(diffPayload)
	})
	server := httptest.NewServer(handler)
	defer server.Close()

	client := &apiClient{
		baseURL: server.URL,
		http:    server.Client(),
	}

	// Single target via manifest path
	if err := neoVerifyAll(context.Background(), client, []string{"--manifest", "/neo/snapshots/10", "--download=false"}); err != nil {
		t.Fatalf("verify-all single failed: %v", err)
	}

	// Multiple heights
	if err := neoVerifyAll(context.Background(), client, []string{"--heights", "10,11", "--download=false"}); err != nil {
		t.Fatalf("verify-all multiple failed: %v", err)
	}
}
