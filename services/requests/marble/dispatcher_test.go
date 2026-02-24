package neorequests

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSanitizeTEEScriptPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "valid relative path", input: "scripts/main.js", want: "scripts/main.js"},
		{name: "cleaned relative path", input: "./scripts/./main.js", want: "scripts/main.js"},
		{name: "windows traversal path", input: "..\\secret.js", wantErr: true},
		{name: "unix traversal path", input: "../secret.js", wantErr: true},
		{name: "absolute path", input: "/etc/passwd", wantErr: true},
		{name: "percent encoded path", input: "scripts/%2e%2e/secret.js", wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := sanitizeTEEScriptPath(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q", tc.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("sanitizeTEEScriptPath(%q) returned error: %v", tc.input, err)
			}
			if got != tc.want {
				t.Fatalf("sanitizeTEEScriptPath(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestLoadTeeScriptSuccess(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/apps/app-1/manifest.json", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"tee_scripts":{"job":{"file":"scripts/main.js","entry_point":"run"}}}`)
	})
	mux.HandleFunc("/apps/app-1/scripts/main.js", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `console.log("ok")`)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := &Service{
		httpClient: server.Client(),
		scriptsURL: server.URL,
	}

	script, entryPoint, err := svc.loadTeeScript(context.Background(), "app-1", "job")
	if err != nil {
		t.Fatalf("loadTeeScript returned error: %v", err)
	}
	if script != `console.log("ok")` {
		t.Fatalf("unexpected script content: %q", script)
	}
	if entryPoint != "run" {
		t.Fatalf("unexpected entry point: %q", entryPoint)
	}
}

func TestLoadTeeScriptRejectsTraversalPath(t *testing.T) {
	t.Parallel()

	scriptFetched := false

	mux := http.NewServeMux()
	mux.HandleFunc("/apps/app-1/manifest.json", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"tee_scripts":{"job":{"file":"..\\secret.js"}}}`)
	})
	mux.HandleFunc("/apps/app-1/secret.js", func(w http.ResponseWriter, _ *http.Request) {
		scriptFetched = true
		_, _ = io.WriteString(w, `console.log("bad")`)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := &Service{
		httpClient: server.Client(),
		scriptsURL: server.URL,
	}

	_, _, err := svc.loadTeeScript(context.Background(), "app-1", "job")
	if err == nil {
		t.Fatal("expected traversal path to be rejected")
	}
	if !strings.Contains(err.Error(), "invalid file path") {
		t.Fatalf("unexpected error: %v", err)
	}
	if scriptFetched {
		t.Fatal("script endpoint should not be fetched when path is invalid")
	}
}

func TestLoadTeeScriptRejectsOversizedScript(t *testing.T) {
	t.Parallel()

	largeScript := strings.Repeat("a", maxTEEScriptBytes+1)

	mux := http.NewServeMux()
	mux.HandleFunc("/apps/app-1/manifest.json", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"tee_scripts":{"job":{"file":"scripts/large.js"}}}`)
	})
	mux.HandleFunc("/apps/app-1/scripts/large.js", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, largeScript)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := &Service{
		httpClient: server.Client(),
		scriptsURL: server.URL,
	}

	_, _, err := svc.loadTeeScript(context.Background(), "app-1", "job")
	if err == nil {
		t.Fatal("expected oversized script error")
	}
	if !strings.Contains(err.Error(), "script exceeds max size") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestNormalizeServiceType(t *testing.T) {
	t.Parallel()
	tests := []struct {
		input, want string
	}{
		{"rng", "rng"},
		{"neovrf", "rng"},
		{"vrf", "rng"},
		{"oracle", "oracle"},
		{"neooracle", "oracle"},
		{"compute", "compute"},
		{"neocompute", "compute"},
		{"confcompute", "compute"},
		{"  RNG  ", "rng"},
		{"unknown", "unknown"},
	}
	for _, tc := range tests {
		if got := normalizeServiceType(tc.input); got != tc.want {
			t.Errorf("normalizeServiceType(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestIsAppActive(t *testing.T) {
	t.Parallel()
	if !isAppActive("active") {
		t.Error("expected active")
	}
	if !isAppActive("Active") {
		t.Error("expected Active to be active")
	}
	if isAppActive("disabled") {
		t.Error("expected disabled to be inactive")
	}
	if isAppActive("") {
		t.Error("expected empty to be inactive")
	}
}

func TestSanitizeError(t *testing.T) {
	t.Parallel()
	if got := sanitizeError("hello\nworld", 0); got != "hello world" {
		t.Errorf("got %q", got)
	}
	if got := sanitizeError("abcdef", 3); got != "abc" {
		t.Errorf("got %q, want abc", got)
	}
	if got := sanitizeError("short", 100); got != "short" {
		t.Errorf("got %q", got)
	}
}

func TestTruncateString(t *testing.T) {
	t.Parallel()
	if got := truncateString("abcdef", 3); got != "abc" {
		t.Errorf("got %q", got)
	}
	if got := truncateString("ab", 10); got != "ab" {
		t.Errorf("got %q", got)
	}
	if got := truncateString("abc", 0); got != "abc" {
		t.Errorf("got %q", got)
	}
}

func TestPermissionEnabled(t *testing.T) {
	t.Parallel()
	perms := map[string]interface{}{
		"rng":     true,
		"oracle":  false,
		"compute": []interface{}{"a"},
		"empty":   []interface{}{},
	}
	if !permissionEnabled(perms, "rng") {
		t.Error("rng should be enabled")
	}
	if permissionEnabled(perms, "oracle") {
		t.Error("oracle should be disabled")
	}
	if !permissionEnabled(perms, "compute") {
		t.Error("compute should be enabled (non-empty slice)")
	}
	if permissionEnabled(perms, "empty") {
		t.Error("empty slice should be disabled")
	}
	if permissionEnabled(perms, "missing") {
		t.Error("missing key should be disabled")
	}
	if permissionEnabled(nil, "rng") {
		t.Error("nil perms should be disabled")
	}
}

func TestCallbackMatches(t *testing.T) {
	t.Parallel()
	// No manifest constraints
	if !callbackMatches(manifestInfo{}, "0xabc", "method") {
		t.Error("empty manifest should match")
	}
	// Method mismatch
	info := manifestInfo{CallbackMethod: "onResult"}
	if callbackMatches(info, "", "wrongMethod") {
		t.Error("method mismatch should not match")
	}
	if !callbackMatches(info, "", "onResult") {
		t.Error("method match should pass")
	}
}

func TestParseManifestInfoEmpty(t *testing.T) {
	t.Parallel()
	info, err := parseManifestInfo(nil)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(info.Permissions) != 0 {
		t.Errorf("expected empty permissions")
	}
}

func TestParseManifestInfoWithPermissions(t *testing.T) {
	t.Parallel()
	raw := []byte(`{"permissions":{"rng":true,"oracle":false},"callback_method":"onResult"}`)
	info, err := parseManifestInfo(raw)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if info.CallbackMethod != "onResult" {
		t.Errorf("CallbackMethod = %q", info.CallbackMethod)
	}
	if !permissionEnabled(info.Permissions, "rng") {
		t.Error("rng should be enabled")
	}
}

func TestParseManifestInfoArrayPermissions(t *testing.T) {
	t.Parallel()
	raw := []byte(`{"permissions":["rng","oracle"]}`)
	info, err := parseManifestInfo(raw)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if _, ok := info.Permissions["rng"]; !ok {
		t.Error("rng should be in permissions")
	}
	if _, ok := info.Permissions["oracle"]; !ok {
		t.Error("oracle should be in permissions")
	}
}

func TestBuildFulfillParams(t *testing.T) {
	t.Parallel()
	params, reqInt, err := buildFulfillParams("123", true, []byte("result"), "")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if reqInt.Int64() != 123 {
		t.Errorf("requestInt = %d, want 123", reqInt.Int64())
	}
	if len(params) != 4 {
		t.Errorf("len(params) = %d, want 4", len(params))
	}
}

func TestBuildFulfillParamsInvalidID(t *testing.T) {
	t.Parallel()
	_, _, err := buildFulfillParams("not-a-number", true, nil, "")
	if err == nil {
		t.Fatal("expected error for invalid request_id")
	}
}

func TestDecodePayload(t *testing.T) {
	t.Parallel()
	// Valid JSON
	result := decodePayload([]byte(`{"key":"value"}`))
	if m, ok := result.(map[string]interface{}); !ok || m["key"] != "value" {
		t.Errorf("unexpected result: %v", result)
	}
	// Empty
	if decodePayload(nil) != nil {
		t.Error("nil should return nil")
	}
	// Non-JSON falls back to base64
	result = decodePayload([]byte{0xff, 0xfe})
	if m, ok := result.(map[string]string); !ok || m["base64"] == "" {
		t.Errorf("expected base64 fallback, got %v", result)
	}
}

func TestDecodeResult(t *testing.T) {
	t.Parallel()
	if decodeResult(nil) != nil {
		t.Error("nil should return nil")
	}
	result := decodeResult([]byte(`"hello"`))
	if result != "hello" {
		t.Errorf("unexpected: %v", result)
	}
	// Non-JSON falls back to hex
	result = decodeResult([]byte{0xab, 0xcd})
	if m, ok := result.(map[string]string); !ok || m["hex"] != "abcd" {
		t.Errorf("expected hex fallback, got %v", result)
	}
}

func TestServiceTypePermission(t *testing.T) {
	t.Parallel()
	tests := []struct{ input, want string }{
		{"rng", "rng"},
		{"oracle", "oracle"},
		{"compute", "compute"},
		{"custom", "custom"},
	}
	for _, tc := range tests {
		if got := serviceTypePermission(tc.input); got != tc.want {
			t.Errorf("serviceTypePermission(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}
