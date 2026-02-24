package neosimulation

import (
	"math/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// newTestService creates a minimal Service for handler tests.
func newTestService(t *testing.T) *Service {
	t.Helper()
	return &Service{
		BaseService: mockBaseService(),
		running:     false,
		miniApps:    []string{"miniapp-test"},
		minInterval: 1000 * time.Millisecond,
		maxInterval: 3000 * time.Millisecond,
		minAmount:   1000000,
		maxAmount:   100000000,
		txCounts:    make(map[string]int64),
		lastTxTimes: make(map[string]time.Time),
		rng:         rand.New(rand.NewSource(42)),
	}
}

// TestHandleStartUnauthorized verifies handleStart returns 403 without admin role.
func TestHandleStartUnauthorized(t *testing.T) {
	s := newTestService(t)

	req := httptest.NewRequest(http.MethodPost, "/start", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	s.handleStart(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

// TestHandleStopUnauthorized verifies handleStop returns 403 without admin role.
func TestHandleStopUnauthorized(t *testing.T) {
	s := newTestService(t)

	req := httptest.NewRequest(http.MethodPost, "/stop", nil)
	rec := httptest.NewRecorder()

	s.handleStop(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

// TestHandleStatusUnauthorized verifies handleStatus returns 403 without admin role.
func TestHandleStatusUnauthorized(t *testing.T) {
	s := newTestService(t)

	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	rec := httptest.NewRecorder()

	s.handleStatus(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

// TestHandleStatusSuccess verifies handleStatus returns 200 with admin role.
func TestHandleStatusSuccess(t *testing.T) {
	s := newTestService(t)

	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	req.Header.Set("X-User-Role", "admin")
	rec := httptest.NewRecorder()

	s.handleStatus(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"running"`)
	assert.Contains(t, rec.Body.String(), `"mini_apps"`)
}

// TestHandleStartInvalidJSON verifies handleStart returns 400 for malformed JSON.
func TestHandleStartInvalidJSON(t *testing.T) {
	s := newTestService(t)

	req := httptest.NewRequest(http.MethodPost, "/start", strings.NewReader(`{not json`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-Role", "admin")
	rec := httptest.NewRecorder()

	s.handleStart(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestHandleStopSuccess verifies handleStop returns 200 when simulation is running.
func TestHandleStopSuccess(t *testing.T) {
	s := newTestService(t)
	// Put service into running state manually
	s.running = true
	s.stopCh = make(chan struct{})
	now := time.Now()
	s.startedAt = &now

	req := httptest.NewRequest(http.MethodPost, "/stop", nil)
	req.Header.Set("X-User-Role", "admin")
	rec := httptest.NewRecorder()

	s.handleStop(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"success":true`)
	assert.False(t, s.running)
}
