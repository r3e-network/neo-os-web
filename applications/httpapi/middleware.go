package httpapi

import (
	"net/http"
	"strings"
)

// withMethod wraps a handler, enforcing the HTTP method and emitting 405 otherwise.
// Use this to reduce repetition in handler registration.
func withMethod(method string, fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			methodNotAllowed(w, method)
			return
		}
		fn(w, r)
	}
}

// methodNotAllowed standardizes 405 responses and sets the Allow header when
// callers supply the set of permitted methods.
func methodNotAllowed(w http.ResponseWriter, methods ...string) {
	if len(methods) > 0 {
		w.Header().Set("Allow", strings.Join(methods, ", "))
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
}
