package httpapi

import (
	"net/http"
	"strings"
)

func templateEscape(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		"\"", "&quot;",
		"'", "&#39;",
	)
	return replacer.Replace(value)
}

// systemDescriptors exposes registered service descriptors for introspection.
func (h *handler) systemDescriptors(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, h.app.Descriptors())
}

// systemDescriptorsHTML renders descriptors in a minimal HTML table for browsers.
func (h *handler) systemDescriptorsHTML(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	descr := h.app.Descriptors()
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte("<!doctype html><html><head><title>Service Descriptors</title><style>body{font-family:sans-serif;padding:16px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;} th{text-align:left;background:#f5f5f5;}</style></head><body>"))
	_, _ = w.Write([]byte("<h2>Registered Services</h2><table><tr><th>Name</th><th>Domain</th><th>Layer</th><th>Capabilities</th></tr>"))
	for _, d := range descr {
		_, _ = w.Write([]byte("<tr><td>" + templateEscape(d.Name) + "</td><td>" + templateEscape(d.Domain) + "</td><td>" + templateEscape(string(d.Layer)) + "</td><td>" + templateEscape(strings.Join(d.Capabilities, ", ")) + "</td></tr>"))
	}
	_, _ = w.Write([]byte("</table></body></html>"))
}
