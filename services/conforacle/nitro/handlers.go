// Package neooracle provides HTTP handlers for the neooracle service.
package neooracle

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/google/uuid"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

// =============================================================================
// HTTP Handlers
// =============================================================================

// handleQuery fetches external data, optionally injecting a secret for auth.
func (s *Service) handleQuery(w http.ResponseWriter, r *http.Request) {
	userID, ok := httputil.RequireUserID(w, r)
	if !ok {
		return
	}

	var input QueryInput
	if !httputil.DecodeJSON(w, r, &input) {
		return
	}

	if input.URL == "" {
		httputil.BadRequest(w, "url required")
		return
	}
	if httputil.StrictIdentityMode() {
		parsed, err := url.Parse(input.URL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" || !strings.EqualFold(parsed.Scheme, "https") {
			httputil.BadRequest(w, "only https urls are allowed in strict identity mode")
			return
		}
	}
	if !s.allowlist.Allows(input.URL) {
		httputil.BadRequest(w, "url not allowed")
		return
	}
	method := strings.ToUpper(strings.TrimSpace(input.Method))
	if method == "" {
		method = http.MethodGet
	}
	switch method {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodHead:
		// allowed
	default:
		httputil.BadRequest(w, "unsupported HTTP method")
		return
	}

	forbiddenHeaders := map[string]bool{
		"host": true, "content-length": true, "transfer-encoding": true,
		"connection": true, "upgrade": true, "te": true,
	}

	headers := make(http.Header)
	for k, v := range input.Headers {
		if forbiddenHeaders[strings.ToLower(k)] {
			continue
		}
		if strings.ContainsAny(k, "\r\n") || strings.ContainsAny(v, "\r\n") {
			httputil.BadRequest(w, "header contains invalid characters")
			return
		}
		headers.Set(k, v)
	}

	// If a secret is requested, fetch it over mTLS and inject.
	if input.SecretName != "" {
		if s.secretProvider == nil {
			httputil.ServiceUnavailable(w, "secret store not configured")
			return
		}
		secret, err := s.secretProvider.GetSecret(r.Context(), userID, input.SecretName)
		if err != nil {
			s.Logger().Error(r.Context(), "failed to fetch secret", err, nil)
			httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
			return
		}
		if strings.ContainsAny(secret, "\r\n") {
			httputil.BadRequest(w, "secret contains invalid characters")
			return
		}
		key := input.SecretAsKey
		if key == "" {
			key = "Authorization"
			secret = "Bearer " + secret
		}
		if forbiddenHeaders[strings.ToLower(key)] {
			httputil.BadRequest(w, "forbidden header name")
			return
		}
		headers.Set(key, secret)
	}

	var body io.Reader
	if input.Body != "" {
		body = bytes.NewBufferString(input.Body)
	}

	req, err := http.NewRequestWithContext(r.Context(), method, input.URL, body)
	if err != nil {
		httputil.BadRequest(w, "invalid request")
		return
	}
	req.Header = headers
	req.Header.Set("X-Request-ID", uuid.New().String())

	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.Logger().Error(r.Context(), "upstream request failed", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}
	defer resp.Body.Close()

	respBody, truncated, err := httputil.ReadAllWithLimit(resp.Body, s.maxBodyBytes)
	if err != nil {
		s.Logger().Error(r.Context(), "failed to read response body", err, nil)
		httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		return
	}
	if truncated {
		httputil.WriteErrorResponse(w, r, http.StatusBadGateway, "", "upstream response too large", map[string]any{
			"limit_bytes": s.maxBodyBytes,
		})
		return
	}

	outHeaders := map[string]string{}
	for k, vals := range resp.Header {
		if len(vals) > 0 && !strings.ContainsAny(vals[0], "\r\n") {
			outHeaders[k] = vals[0]
		}
	}

	var attestation string
	if s.Nitro() != nil {
		if report, err := s.Nitro().Attest([]byte(input.URL)); err == nil && report != nil {
			attestation = report.Document
		}
	}

	httputil.WriteJSON(w, http.StatusOK, QueryResponse{
		StatusCode:  resp.StatusCode,
		Headers:     outHeaders,
		Body:        string(respBody),
		Attestation: attestation,
	})
}
