package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJamPackagesHandlesEnvelope(t *testing.T) {
	handler := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte(`{"items":[{"id":"pkg-1"}],"next_offset":1}`)); err != nil {
			t.Fatalf("write response: %v", err)
		}
	}))
	defer handler.Close()

	client := &apiClient{
		baseURL: handler.URL,
		http:    &http.Client{},
	}

	data, err := client.request(context.Background(), http.MethodGet, "/jam/packages", nil)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	var envelope struct {
		Items      []map[string]any `json:"items"`
		NextOffset int              `json:"next_offset"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		t.Fatalf("decode envelope: %v", err)
	}
	out, _ := json.Marshal(envelope.Items)
	if !bytes.Contains(out, []byte(`"pkg-1"`)) {
		t.Fatalf("expected package id in output, got %s", string(out))
	}
}
