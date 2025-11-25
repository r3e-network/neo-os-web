package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestParseKeyValue(t *testing.T) {
	values, err := parseKeyValue("foo=bar,baz=qux")
	if err != nil {
		t.Fatalf("parseKeyValue returned error: %v", err)
	}
	expected := map[string]string{"foo": "bar", "baz": "qux"}
	if !reflect.DeepEqual(values, expected) {
		t.Fatalf("expected %v, got %v", expected, values)
	}

	if _, err := parseKeyValue("invalid"); err == nil {
		t.Fatalf("expected error for missing '='")
	}
}

func TestSplitCommaList(t *testing.T) {
	result := splitCommaList(" a , b ,c ")
	expected := []string{"a", "b", "c"}
	if !reflect.DeepEqual(result, expected) {
		t.Fatalf("expected %v, got %v", expected, result)
	}

	if res := splitCommaList("   "); res != nil {
		t.Fatalf("expected nil for blank input, got %v", res)
	}
}

func TestLoadJSONPayload(t *testing.T) {
	inline := `{"number":42,"nested":{"key":"value"}}`
	payload, err := loadJSONPayload(inline, "")
	if err != nil {
		t.Fatalf("loadJSONPayload inline returned error: %v", err)
	}
	payloadMap, ok := payload.(map[string]any)
	if !ok {
		t.Fatalf("expected map payload, got %T", payload)
	}
	nested, ok := payloadMap["nested"].(map[string]any)
	if !ok || nested["key"] != "value" {
		t.Fatalf("unexpected payload: %v", payloadMap)
	}

	dir := t.TempDir()
	path := filepath.Join(dir, "payload.json")
	if err := os.WriteFile(path, []byte(`{"hello":"file"}`), 0o600); err != nil {
		t.Fatalf("write payload file: %v", err)
	}
	filePayload, err := loadJSONPayload("", path)
	if err != nil {
		t.Fatalf("loadJSONPayload file returned error: %v", err)
	}
	fileMap, ok := filePayload.(map[string]any)
	if !ok || fileMap["hello"] != "file" {
		t.Fatalf("unexpected file payload: %v", filePayload)
	}

	if _, err := loadJSONPayload(inline, path); err == nil {
		t.Fatalf("expected error when both inline and file are provided")
	}
}

func TestHandleBusEvents(t *testing.T) {
	var gotPath string
	var gotBody []byte
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotBody, _ = io.ReadAll(r.Body)
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	t.Cleanup(srv.Close)

	client := &apiClient{baseURL: srv.URL, token: "t", http: srv.Client()}
	err := handleBus(context.Background(), client, []string{"events", "--event", "observation", "--payload", `{"foo":"bar"}`})
	if err != nil {
		t.Fatalf("handleBus events: %v", err)
	}
	if gotPath != "/system/events" {
		t.Fatalf("expected path /system/events, got %s", gotPath)
	}
	if len(gotBody) == 0 {
		t.Fatalf("expected body sent")
	}
	if gotAuth != "Bearer t" {
		t.Fatalf("expected auth header, got %q", gotAuth)
	}
}

func TestHandleBusComputeRequiresPayload(t *testing.T) {
	client := &apiClient{baseURL: "http://example.invalid", token: "t", http: http.DefaultClient}
	err := handleBus(context.Background(), client, []string{"compute"})
	if err == nil {
		t.Fatalf("expected error for missing payload")
	}
}

func TestHandleBusComputeSuccess(t *testing.T) {
	var gotPath string
	var gotBody []byte
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotBody, _ = io.ReadAll(r.Body)
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"module":"compute-ok","result":"ok"}]}`))
	}))
	t.Cleanup(srv.Close)

	client := &apiClient{baseURL: srv.URL, token: "t", http: srv.Client()}
	err := handleBus(context.Background(), client, []string{"compute", "--payload", `{"function_id":"fn","account_id":"acct"}`})
	if err != nil {
		t.Fatalf("handleBus compute: %v", err)
	}
	if gotPath != "/system/compute" {
		t.Fatalf("expected path /system/compute, got %s", gotPath)
	}
	if len(gotBody) == 0 {
		t.Fatalf("expected body sent")
	}
	if gotAuth != "Bearer t" {
		t.Fatalf("expected auth header, got %q", gotAuth)
	}
}

func TestHandleBusData(t *testing.T) {
	var gotPath string
	var gotBody []byte
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotBody, _ = io.ReadAll(r.Body)
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	t.Cleanup(srv.Close)

	client := &apiClient{baseURL: srv.URL, token: "t", http: srv.Client()}
	err := handleBus(context.Background(), client, []string{"data", "--topic", "stream-1", "--payload", `{"price":123}`})
	if err != nil {
		t.Fatalf("handleBus data: %v", err)
	}
	if gotPath != "/system/data" {
		t.Fatalf("expected path /system/data, got %s", gotPath)
	}
	if len(gotBody) == 0 {
		t.Fatalf("expected body sent")
	}
	if gotAuth != "Bearer t" {
		t.Fatalf("expected auth header, got %q", gotAuth)
	}
}

func TestNeoStorageSummaryEndpoint(t *testing.T) {
	var summaryHits, storageHits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/neo/storage-summary/10":
			summaryHits++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[{"contract":"0xdead","kv_entries":2,"diff_entries":1}]`))
		default:
			storageHits++
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	t.Cleanup(srv.Close)

	client := &apiClient{baseURL: srv.URL, http: srv.Client()}

	if err := neoStorageSummary(context.Background(), client, []string{"10"}); err != nil {
		t.Fatalf("storage summary: %v", err)
	}
	if summaryHits != 1 {
		t.Fatalf("expected summary endpoint hit, got %d", summaryHits)
	}
	if storageHits != 0 {
		t.Fatalf("unexpected fallback hit: %d", storageHits)
	}
}

func TestNeoStorageSummaryFallback(t *testing.T) {
	var summaryHits, storageHits, diffHits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/neo/storage-summary/10":
			summaryHits++
			http.Error(w, "missing", http.StatusNotFound)
		case "/neo/storage/10":
			storageHits++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[{"contract":"0xdead","kv":[{"key":"00","value":"ff"}]}]`))
		case "/neo/storage-diff/10":
			diffHits++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[{"contract":"0xdead","kv_diff":[{"key":"00","value":"aa"}]}]`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	t.Cleanup(srv.Close)

	client := &apiClient{baseURL: srv.URL, http: srv.Client()}

	if err := neoStorageSummary(context.Background(), client, []string{"10"}); err != nil {
		t.Fatalf("storage summary fallback: %v", err)
	}
	if summaryHits != 1 {
		t.Fatalf("expected summary endpoint attempted, got %d", summaryHits)
	}
	if storageHits != 1 || diffHits != 1 {
		t.Fatalf("expected fallback hits storage=%d diff=%d", storageHits, diffHits)
	}
}

func TestExportModulesJSONAndCSV(t *testing.T) {
	mods := []struct {
		Name        string   `json:"name"`
		Domain      string   `json:"domain"`
		Category    string   `json:"category"`
		Interfaces  []string `json:"interfaces"`
		Permissions []string `json:"permissions"`
		Notes       []string `json:"notes"`
		DependsOn   []string `json:"depends_on"`
		Status      string   `json:"status"`
		Error       string   `json:"error"`
		Ready       string   `json:"ready_status"`
		ReadyErr    string   `json:"ready_error"`
		Started     string   `json:"started_at"`
		Stopped     string   `json:"stopped_at"`
		Updated     string   `json:"updated_at"`
		StartNanos  int64    `json:"start_nanos"`
		StopNanos   int64    `json:"stop_nanos"`
		APIs        []struct {
			Name      string `json:"name"`
			Surface   string `json:"surface"`
			Stability string `json:"stability"`
			Summary   string `json:"summary"`
		} `json:"apis"`
	}{
		{
			Name:       "svc-foo",
			Domain:     "foo",
			Category:   "compute",
			Interfaces: []string{"compute"},
			Status:     "started",
			Ready:      "ready",
			APIs: []struct {
				Name      string `json:"name"`
				Surface   string `json:"surface"`
				Stability string `json:"stability"`
				Summary   string `json:"summary"`
			}{
				{Name: "compute", Surface: "compute", Stability: "stable", Summary: "exec"},
			},
		},
	}

	dir := t.TempDir()
	jsonPath := filepath.Join(dir, "modules.json")
	if err := exportModules(mods, jsonPath); err != nil {
		t.Fatalf("export json: %v", err)
	}
	jsonData, err := os.ReadFile(jsonPath)
	if err != nil {
		t.Fatalf("read json: %v", err)
	}
	if !strings.Contains(string(jsonData), "svc-foo") || !strings.Contains(string(jsonData), "compute") {
		t.Fatalf("exported json missing fields: %s", string(jsonData))
	}

	csvPath := filepath.Join(dir, "modules.csv")
	if err := exportModules(mods, csvPath); err != nil {
		t.Fatalf("export csv: %v", err)
	}
	csvData, err := os.ReadFile(csvPath)
	if err != nil {
		t.Fatalf("read csv: %v", err)
	}
	if !strings.Contains(string(csvData), "svc-foo") || !strings.Contains(string(csvData), "compute") {
		t.Fatalf("exported csv missing fields: %s", string(csvData))
	}
}
