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
