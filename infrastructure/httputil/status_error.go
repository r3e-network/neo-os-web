package httputil

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// HTTPStatusError captures a non-2xx HTTP response for callers that need
// status-aware error handling.
type HTTPStatusError struct {
	Method     string
	URL        string
	StatusCode int
	Status     string
	Body       string
}

func (e *HTTPStatusError) Error() string {
	if e == nil {
		return "http request failed"
	}
	if msg := strings.TrimSpace(e.Body); msg != "" {
		return fmt.Sprintf("http %d: %s", e.StatusCode, msg)
	}
	return fmt.Sprintf("http %d", e.StatusCode)
}

// IsHTTPStatusError reports whether err wraps an HTTPStatusError with the
// specified status code.
func IsHTTPStatusError(err error, statusCode int) bool {
	if err == nil {
		return false
	}
	var httpErr *HTTPStatusError
	if !errors.As(err, &httpErr) {
		return false
	}
	return httpErr.StatusCode == statusCode
}

// BuildHTTPStatusError constructs an HTTPStatusError from a non-2xx response
// and attempts to capture a bounded error body for diagnostics.
func BuildHTTPStatusError(resp *http.Response, method, requestURL string, bodyLimit int64) (*HTTPStatusError, error) {
	if resp == nil {
		return nil, fmt.Errorf("response is nil")
	}

	httpErr := &HTTPStatusError{
		Method:     strings.TrimSpace(method),
		URL:        strings.TrimSpace(requestURL),
		StatusCode: resp.StatusCode,
		Status:     strings.TrimSpace(resp.Status),
	}

	if resp.Body == nil || resp.Body == http.NoBody {
		return httpErr, nil
	}

	if bodyLimit <= 0 {
		bodyLimit = 32 << 10
	}

	body, truncated, err := ReadAllWithLimit(resp.Body, bodyLimit)
	if err != nil {
		return httpErr, err
	}

	msg := strings.TrimSpace(string(body))
	if truncated {
		msg += "...(truncated)"
	}
	httpErr.Body = msg
	return httpErr, nil
}

// BuildHTTPStatusErrorFromRequest is a convenience wrapper that derives method
// and URL from req (when provided) and forwards to BuildHTTPStatusError.
func BuildHTTPStatusErrorFromRequest(resp *http.Response, req *http.Request, bodyLimit int64) (*HTTPStatusError, error) {
	if req == nil {
		return BuildHTTPStatusError(resp, "", "", bodyLimit)
	}

	requestURL := ""
	if req.URL != nil {
		requestURL = req.URL.String()
	}
	return BuildHTTPStatusError(resp, req.Method, requestURL, bodyLimit)
}

// WrapReadBodyError wraps readErr with baseErr using the standard message used
// across HTTP client call sites. If either error is nil, the other is returned.
func WrapReadBodyError(baseErr, readErr error) error {
	if readErr == nil {
		return baseErr
	}
	if baseErr == nil {
		return readErr
	}
	return fmt.Errorf("%w (failed to read body: %v)", baseErr, readErr)
}
