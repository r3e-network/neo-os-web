package httpapi

import "net/http"

// route describes a single endpoint with an optional method guard.
type route struct {
	pattern string
	method  string
	handler http.HandlerFunc
}

// mountRoutes attaches the provided routes to the mux, wrapping handlers with
// method enforcement when a method is specified.
func mountRoutes(mux *http.ServeMux, routes ...route) {
	for _, rt := range routes {
		if rt.pattern == "" || rt.handler == nil {
			continue
		}
		handler := rt.handler
		if rt.method != "" {
			handler = withMethod(rt.method, handler)
		}
		mux.HandleFunc(rt.pattern, handler)
	}
}
