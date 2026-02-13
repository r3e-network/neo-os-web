package httputil

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/logging"
)

type echoReq struct {
	Name string `json:"name"`
}

type echoResp struct {
	Greeting string `json:"greeting"`
}

func testLogger() *logging.Logger {
	return logging.NewFromEnv("test")
}

// ---------------------------------------------------------------------------
// HandleJSON
// ---------------------------------------------------------------------------

func TestHandleJSON_Success(t *testing.T) {
	h := HandleJSON[echoReq, echoResp](testLogger(), func(_ context.Context, req *echoReq) (echoResp, error) {
		return echoResp{Greeting: "hello " + req.Name}, nil
	})

	body := strings.NewReader(`{"name":"world"}`)
	r := httptest.NewRequest(http.MethodPost, "/", body)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var resp echoResp
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Greeting != "hello world" {
		t.Errorf("greeting = %q, want %q", resp.Greeting, "hello world")
	}
}

func TestHandleJSON_BadBody(t *testing.T) {
	h := HandleJSON[echoReq, echoResp](testLogger(), func(_ context.Context, req *echoReq) (echoResp, error) {
		t.Fatal("handler should not be called")
		return echoResp{}, nil
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{invalid`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandleJSON_HandlerError(t *testing.T) {
	h := HandleJSON[echoReq, echoResp](testLogger(), func(_ context.Context, req *echoReq) (echoResp, error) {
		return echoResp{}, fmt.Errorf("boom")
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x"}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}

func TestHandleJSON_NotFoundError(t *testing.T) {
	h := HandleJSON[echoReq, echoResp](testLogger(), func(_ context.Context, req *echoReq) (echoResp, error) {
		return echoResp{}, &NotFoundError{Message: "gone"}
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x"}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestHandleJSON_ValidationError(t *testing.T) {
	h := HandleJSON[echoReq, echoResp](testLogger(), func(_ context.Context, req *echoReq) (echoResp, error) {
		return echoResp{}, &ValidationError{Message: "bad input"}
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x"}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// ---------------------------------------------------------------------------
// HandleNoBody
// ---------------------------------------------------------------------------

func TestHandleNoBody_Success(t *testing.T) {
	h := HandleNoBody[echoResp](testLogger(), func(_ context.Context) (echoResp, error) {
		return echoResp{Greeting: "hi"}, nil
	})

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var resp echoResp
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Greeting != "hi" {
		t.Errorf("greeting = %q, want %q", resp.Greeting, "hi")
	}
}

func TestHandleNoBody_Error(t *testing.T) {
	h := HandleNoBody[echoResp](testLogger(), func(_ context.Context) (echoResp, error) {
		return echoResp{}, &ConflictError{Message: "dup"}
	})

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusConflict)
	}
}

// ---------------------------------------------------------------------------
// HandleNoBodyWithUserAuth
// ---------------------------------------------------------------------------

func TestHandleNoBodyWithUserAuth_NoUser(t *testing.T) {
	h := HandleNoBodyWithUserAuth[echoResp](testLogger(), func(_ context.Context, _ string) (echoResp, error) {
		t.Fatal("handler should not be called")
		return echoResp{}, nil
	})

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	// No user ID header
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

// ---------------------------------------------------------------------------
// HandleJSONWithUserAuth
// ---------------------------------------------------------------------------

func TestHandleJSONWithUserAuth_NoUser(t *testing.T) {
	h := HandleJSONWithUserAuth[echoReq, echoResp](testLogger(), func(_ context.Context, _ string, _ *echoReq) (echoResp, error) {
		t.Fatal("handler should not be called")
		return echoResp{}, nil
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x"}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

// ---------------------------------------------------------------------------
// HandleJSONWithServiceAuth
// ---------------------------------------------------------------------------

func TestHandleJSONWithServiceAuth_NoService(t *testing.T) {
	h := HandleJSONWithServiceAuth[echoReq, echoResp](testLogger(), func(_ context.Context, _ string, _ *echoReq) (echoResp, error) {
		t.Fatal("handler should not be called")
		return echoResp{}, nil
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x"}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

// ---------------------------------------------------------------------------
// ServiceUnavailableError
// ---------------------------------------------------------------------------

func TestHandleJSON_ServiceUnavailableError(t *testing.T) {
	h := HandleJSON[echoReq, echoResp](testLogger(), func(_ context.Context, req *echoReq) (echoResp, error) {
		return echoResp{}, &ServiceUnavailableError{Message: "down"}
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x"}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusServiceUnavailable)
	}
}

// ---------------------------------------------------------------------------
// Nil logger (should not panic)
// ---------------------------------------------------------------------------

func TestHandleJSON_NilLogger(t *testing.T) {
	h := HandleJSON[echoReq, echoResp](nil, func(_ context.Context, req *echoReq) (echoResp, error) {
		return echoResp{}, fmt.Errorf("boom")
	})

	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"x"}`))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusInternalServerError)
	}
}
