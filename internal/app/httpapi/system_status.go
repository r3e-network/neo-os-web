package httpapi

import (
	"context"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/internal/app/jam"
	"github.com/R3E-Network/service_layer/internal/app/metrics"
	"github.com/R3E-Network/service_layer/internal/version"
)

func (h *handler) health(w http.ResponseWriter, r *http.Request) {
	if h.modulesFn != nil {
		if ready := h.checkReadiness(); len(ready) > 0 {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"status":  "degraded",
				"modules": ready,
			})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *handler) readyz(w http.ResponseWriter, r *http.Request) {
	if h.modulesFn == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	if notReady := h.checkReadiness(); len(notReady) == 0 {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	// readyz should also be safe for Prometheus scrapes; avoid heavy payloads.
	writeJSON(w, http.StatusServiceUnavailable, map[string]any{
		"status":  "degraded",
		"modules": h.checkReadiness(),
	})
}

func (h *handler) livez(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// checkReadiness returns modules that are not ready.
func (h *handler) checkReadiness() []ModuleStatus {
	if h.modulesFn == nil {
		return nil
	}
	modules := h.modulesFn()
	var notReady []ModuleStatus
	for _, m := range modules {
		ready := strings.ToLower(strings.TrimSpace(m.Ready))
		if ready == "" || ready == "ready" {
			continue
		}
		notReady = append(notReady, m)
	}
	return notReady
}

func (h *handler) systemVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"version":    version.Version,
		"commit":     version.GitCommit,
		"built_at":   version.BuildTime,
		"go_version": version.GoVersion,
	})
}

func (h *handler) systemStatus(w http.ResponseWriter, r *http.Request) {
	var modules []ModuleStatus
	if h.modulesFn != nil {
		modules = h.modulesFn()
	}
	jamStatus := map[string]any{
		"enabled":              h.jamCfg.Enabled,
		"store":                h.jamCfg.Store,
		"rate_limit_per_min":   h.jamCfg.RateLimitPerMinute,
		"max_preimage_bytes":   h.jamCfg.MaxPreimageBytes,
		"max_pending_packages": h.jamCfg.MaxPendingPackages,
		"auth_required":        h.jamCfg.AuthRequired,
		"legacy_list_response": h.jamCfg.LegacyListResponse,
		"accumulators_enabled": h.jamCfg.AccumulatorsEnabled,
		"accumulator_hash":     h.jamCfg.AccumulatorHash,
	}
	if h.jamCfg.AccumulatorsEnabled && h.jamStore != nil {
		if lister, ok := h.jamStore.(interface {
			AccumulatorRoots(context.Context) ([]jam.AccumulatorRoot, error)
		}); ok {
			if roots, err := lister.AccumulatorRoots(r.Context()); err == nil && len(roots) > 0 {
				jamStatus["accumulator_roots"] = roots
			}
		}
	}
	payload := map[string]any{
		"status": "ok",
		"version": map[string]string{
			"version":    version.Version,
			"commit":     version.GitCommit,
			"built_at":   version.BuildTime,
			"go_version": version.GoVersion,
		},
		"services": h.app.Descriptors(),
		"jam":      jamStatus,
	}
	if h.listenAddr != nil {
		if addr := strings.TrimSpace(h.listenAddr()); addr != "" {
			payload["listen_addr"] = addr
		}
	}
	if len(modules) > 0 {
		payload["modules"] = modules
		payload["modules_summary"] = summarizeModules(modules)
		payload["modules_meta"] = summarizeModuleHealth(modules)
		payload["modules_timings"] = summarizeModuleTimings(modules)
		payload["modules_uptime"] = summarizeModuleUptime(modules)
		if layers := summarizeModuleLayers(modules); len(layers) > 0 {
			payload["modules_layers"] = layers
		}
		if caps := summarizeModuleCapabilities(modules); len(caps) > 0 {
			payload["modules_capabilities"] = caps
		}
		if quotas := summarizeModuleQuotas(modules); len(quotas) > 0 {
			payload["modules_quotas"] = quotas
		}
		if req := summarizeModuleRequiresAPIs(modules); len(req) > 0 {
			payload["modules_requires_apis"] = req
		}
		if missing := summarizeMissingRequiredAPIs(modules); len(missing) > 0 {
			payload["modules_requires_missing"] = missing
		}
		if apiSummary := summarizeModuleAPIs(modules); len(apiSummary) > 0 {
			payload["modules_api_summary"] = apiSummary
		}
		// APIMeta derived from summary for consistency with interface filtering.
		if apiMeta := summarizeModuleAPIMeta(modules, h.resolveSlowThreshold()); len(apiMeta) > 0 {
			payload["modules_api_meta"] = apiMeta
		}
		if waiting := summarizeModulesWaitingForDeps(modules); len(waiting) > 0 {
			payload["modules_waiting_deps"] = waiting
		}
		if waitingReasons := summarizeModulesWaitingReasons(modules); len(waitingReasons) > 0 {
			payload["modules_waiting_reasons"] = waitingReasons
		}
		slowThreshold := h.resolveSlowThreshold()
		payload["modules_slow_threshold_ms"] = slowThreshold
		if slow := summarizeSlowModules(modules, slowThreshold); len(slow) > 0 {
			payload["modules_slow"] = slow
		}
		metrics.RecordModuleMetrics(toModuleMetrics(modules, summarizeModulesWaitingReasons(modules)))
		metrics.RecordModuleTimings(toModuleTimings(modules))
	}
	if fanout := metrics.BusFanoutSnapshot(); len(fanout) > 0 {
		payload["bus_fanout"] = fanout
	}
	if recent := metrics.BusFanoutWindow(resolveBusWindow(r)); len(recent) > 0 {
		payload["bus_fanout_recent"] = recent
		payload["bus_fanout_recent_window_seconds"] = int(resolveBusWindow(r).Seconds())
	}
	if h.busMaxBytes > 0 {
		payload["bus_max_bytes"] = h.busMaxBytes
		if h.busMaxBytes > 10<<20 {
			payload["bus_max_bytes_warning"] = "bus_max_bytes exceeds 10 MiB; review edge limits and abuse risk"
		}
	}
	if h.neo != nil {
		if neoStatus, err := h.neo.Status(r.Context()); err == nil {
			payload["neo"] = neoStatus
		} else {
			payload["neo"] = map[string]any{"enabled": false, "error": err.Error()}
		}
	}
	if sup := checkSupabaseHealth(r.Context()); sup != nil {
		payload["supabase"] = sup
		if checks, ok := sup["checks"].([]map[string]any); ok {
			metrics.RecordExternalHealth("supabase", checks)
		}
	}
	writeJSON(w, http.StatusOK, payload)
}

func summarizeModules(modules []ModuleStatus) map[string][]string {
	summary := map[string][]string{
		"data":        {},
		"event":       {},
		"compute":     {},
		"ledger":      {},
		"indexer":     {},
		"rpc":         {},
		"data-source": {},
		"contracts":   {},
		"gasbank":     {},
		"crypto":      {},
	}
	seen := map[string]map[string]bool{
		"data":        {},
		"event":       {},
		"compute":     {},
		"ledger":      {},
		"indexer":     {},
		"rpc":         {},
		"data-source": {},
		"contracts":   {},
		"gasbank":     {},
		"crypto":      {},
	}
	add := func(kind, name string) {
		if name == "" || seen[kind][name] {
			return
		}
		seen[kind][name] = true
		summary[kind] = append(summary[kind], name)
	}
	for _, m := range modules {
		for _, iface := range m.Interfaces {
			switch strings.ToLower(strings.TrimSpace(iface)) {
			case "data", "event", "compute", "ledger", "indexer", "rpc", "data-source", "contracts", "gasbank", "crypto":
				add(strings.ToLower(strings.TrimSpace(iface)), m.Name)
			}
		}
		switch strings.ToLower(strings.TrimSpace(m.Category)) {
		case "data", "event", "compute", "ledger", "indexer", "rpc", "data-source", "contracts", "gasbank", "crypto":
			add(strings.ToLower(strings.TrimSpace(m.Category)), m.Name)
		}
	}
	return summary
}

func summarizeModuleAPIs(modules []ModuleStatus) map[string][]string {
	summary := make(map[string][]string)
	seen := make(map[string]map[string]bool)
	for _, m := range modules {
		name := strings.TrimSpace(m.Name)
		if name == "" {
			continue
		}
		for _, api := range m.APIs {
			key := strings.TrimSpace(string(api.Surface))
			if key == "" {
				key = strings.TrimSpace(api.Name)
			}
			key = strings.ToLower(key)
			if key == "" {
				continue
			}
			if _, ok := seen[key]; !ok {
				seen[key] = make(map[string]bool)
			}
			if seen[key][name] {
				continue
			}
			summary[key] = append(summary[key], name)
			seen[key][name] = true
		}
	}
	for k := range summary {
		sort.Strings(summary[k])
	}
	return summary
}

// checkSupabaseHealth probes optional Supabase surfaces if the corresponding env vars are set.
// Supported envs: SUPABASE_HEALTH_URL (generic), SUPABASE_HEALTH_GOTRUE, SUPABASE_HEALTH_POSTGREST,
// SUPABASE_HEALTH_KONG, SUPABASE_HEALTH_STUDIO. Results are summarized in /system/status.
func checkSupabaseHealth(ctx context.Context) map[string]any {
	endpoints := map[string]string{
		"default":   strings.TrimSpace(os.Getenv("SUPABASE_HEALTH_URL")),
		"gotrue":    strings.TrimSpace(os.Getenv("SUPABASE_HEALTH_GOTRUE")),
		"postgrest": strings.TrimSpace(os.Getenv("SUPABASE_HEALTH_POSTGREST")),
		"kong":      strings.TrimSpace(os.Getenv("SUPABASE_HEALTH_KONG")),
		"studio":    strings.TrimSpace(os.Getenv("SUPABASE_HEALTH_STUDIO")),
	}
	checks := []map[string]any{}
	up := 0
	for name, url := range endpoints {
		if url == "" {
			continue
		}
		result := probeHealth(ctx, url)
		result["name"] = name
		checks = append(checks, result)
		if state, ok := result["state"].(string); ok && state == "up" {
			up++
		}
	}
	if len(checks) == 0 {
		return nil
	}
	state := "down"
	switch {
	case up == len(checks):
		state = "up"
	case up > 0:
		state = "partial"
	}
	return map[string]any{
		"state":  state,
		"checks": checks,
	}
}

func probeHealth(ctx context.Context, url string) map[string]any {
	start := time.Now()
	client := &http.Client{Timeout: 2 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return map[string]any{"state": "down", "error": err.Error(), "url": url, "duration_ms": time.Since(start).Milliseconds()}
	}
	resp, err := client.Do(req)
	if err != nil {
		return map[string]any{"state": "down", "error": err.Error(), "url": url, "duration_ms": time.Since(start).Milliseconds()}
	}
	defer resp.Body.Close()
	state := "down"
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		state = "up"
	}
	return map[string]any{
		"status":      resp.Status,
		"state":       state,
		"url":         url,
		"code":        resp.StatusCode,
		"duration_ms": time.Since(start).Milliseconds(),
	}
}

func summarizeModuleAPIMeta(modules []ModuleStatus, slowThreshold float64) map[string]map[string]int {
	meta := make(map[string]map[string]int)
	if len(modules) == 0 {
		return meta
	}
	// reuse api summary to avoid double-counting duplicate surfaces on a module
	apiSummary := summarizeModuleAPIs(modules)
	for surface, mods := range apiSummary {
		meta[surface] = map[string]int{"total": len(mods), "slow": 0}
	}
	for _, m := range modules {
		for _, api := range m.APIs {
			key := strings.TrimSpace(string(api.Surface))
			if key == "" {
				key = strings.TrimSpace(api.Name)
			}
			key = strings.ToLower(key)
			if key == "" {
				continue
			}
			if slowThreshold > 0 && ((float64(m.StartNanos)/1e6) >= slowThreshold || (float64(m.StopNanos)/1e6) >= slowThreshold) {
				if counts, ok := meta[key]; ok {
					counts["slow"]++
				}
			}
		}
	}
	return meta
}

// summarizeModulesWaitingForDeps returns modules that explicitly report dependency wait.
func summarizeModulesWaitingForDeps(modules []ModuleStatus) []string {
	var waiting []string
	for _, m := range modules {
		if m.ReadyErr != "" && strings.Contains(strings.ToLower(m.ReadyErr), "dependenc") {
			waiting = append(waiting, m.Name)
		}
	}
	sort.Strings(waiting)
	return waiting
}

// summarizeModulesWaitingReasons returns dependency wait reasons keyed by module name.
func summarizeModulesWaitingReasons(modules []ModuleStatus) map[string]string {
	waiting := make(map[string]string)
	for _, m := range modules {
		if m.ReadyErr != "" && strings.Contains(strings.ToLower(m.ReadyErr), "dependenc") {
			waiting[m.Name] = m.ReadyErr
		}
	}
	return waiting
}

func toModuleMetrics(modules []ModuleStatus, waitingReasons map[string]string) []metrics.ModuleMetric {
	out := make([]metrics.ModuleMetric, 0, len(modules))
	for _, m := range modules {
		out = append(out, metrics.ModuleMetric{
			Name:    m.Name,
			Domain:  m.Domain,
			Status:  m.Status,
			Ready:   m.Ready,
			Waiting: waitingReasons[m.Name] != "",
		})
	}
	return out
}

func toModuleTimings(modules []ModuleStatus) []metrics.ModuleTiming {
	out := make([]metrics.ModuleTiming, 0, len(modules))
	for _, m := range modules {
		out = append(out, metrics.ModuleTiming{
			Name:         m.Name,
			Domain:       m.Domain,
			StartSeconds: float64(m.StartNanos) / 1e9,
			StopSeconds:  float64(m.StopNanos) / 1e9,
		})
	}
	return out
}

func resolveBusWindow(r *http.Request) time.Duration {
	if r == nil {
		return 5 * time.Minute
	}
	windowStr := strings.TrimSpace(r.URL.Query().Get("bus_window"))
	if windowStr == "" {
		return 5 * time.Minute
	}
	dur, err := time.ParseDuration(windowStr)
	if err != nil || dur <= 0 || dur > 30*time.Minute {
		return 5 * time.Minute
	}
	return dur
}

// summarizeModuleHealth produces a compact snapshot for operators (counts by status/readiness).
func summarizeModuleHealth(modules []ModuleStatus) map[string]int {
	meta := map[string]int{
		"total":      len(modules),
		"started":    0,
		"failed":     0,
		"stop_error": 0,
		"not_ready":  0,
	}
	for _, m := range modules {
		switch strings.ToLower(strings.TrimSpace(m.Status)) {
		case "started":
			meta["started"]++
		case "failed":
			meta["failed"]++
		case "stop-error":
			meta["stop_error"]++
		}
		if ready := strings.ToLower(strings.TrimSpace(m.Ready)); ready != "" && ready != "ready" {
			meta["not_ready"]++
		}
	}
	return meta
}

// summarizeModuleTimings converts nanos to milliseconds for operator readability.
func summarizeModuleTimings(modules []ModuleStatus) map[string]map[string]float64 {
	out := make(map[string]map[string]float64, len(modules))
	for _, m := range modules {
		if m.Name == "" {
			continue
		}
		startMS := float64(m.StartNanos) / 1e6
		stopMS := float64(m.StopNanos) / 1e6
		if startMS == 0 && stopMS == 0 {
			continue
		}
		out[m.Name] = map[string]float64{
			"start_ms": startMS,
			"stop_ms":  stopMS,
		}
	}
	return out
}

// summarizeModuleUptime returns seconds each module has been up (uses StoppedAt when present).
func summarizeModuleUptime(modules []ModuleStatus) map[string]float64 {
	now := time.Now()
	out := make(map[string]float64, len(modules))
	for _, m := range modules {
		if m.Name == "" || m.StartedAt == nil {
			continue
		}
		end := now
		if m.StoppedAt != nil {
			end = *m.StoppedAt
		}
		sec := end.Sub(*m.StartedAt).Seconds()
		if sec < 0 {
			sec = 0
		}
		out[m.Name] = sec
	}
	return out
}

// summarizeSlowModules returns module names whose start/stop timings exceed the threshold (ms).
func summarizeSlowModules(modules []ModuleStatus, thresholdMS float64) []string {
	if thresholdMS <= 0 {
		return nil
	}
	var slow []string
	seen := map[string]bool{}
	for _, m := range modules {
		if m.Name == "" {
			continue
		}
		startMS := float64(m.StartNanos) / 1e6
		stopMS := float64(m.StopNanos) / 1e6
		if (startMS > 0 && startMS >= thresholdMS) || (stopMS > 0 && stopMS >= thresholdMS) {
			if !seen[m.Name] {
				slow = append(slow, m.Name)
				seen[m.Name] = true
			}
		}
	}
	sort.Strings(slow)
	return slow
}

// summarizeModuleCapabilities returns capabilities per module.
func summarizeModuleCapabilities(modules []ModuleStatus) map[string][]string {
	out := make(map[string][]string)
	for _, m := range modules {
		if len(m.Capabilities) == 0 {
			continue
		}
		out[m.Name] = append([]string{}, m.Capabilities...)
	}
	return out
}

// summarizeModuleLayers groups module names by declared layer (service|runner|infra).
func summarizeModuleLayers(modules []ModuleStatus) map[string][]string {
	out := make(map[string][]string)
	seen := make(map[string]map[string]bool)
	for _, m := range modules {
		layer := strings.TrimSpace(strings.ToLower(m.Layer))
		if layer == "" {
			layer = "service"
		}
		if _, ok := seen[layer]; !ok {
			seen[layer] = make(map[string]bool)
		}
		if seen[layer][m.Name] {
			continue
		}
		seen[layer][m.Name] = true
		out[layer] = append(out[layer], m.Name)
	}
	for layer := range out {
		sort.Strings(out[layer])
	}
	return out
}

// summarizeModuleQuotas returns quotas per module.
func summarizeModuleQuotas(modules []ModuleStatus) map[string]map[string]string {
	out := make(map[string]map[string]string)
	for _, m := range modules {
		if len(m.Quotas) == 0 {
			continue
		}
		q := make(map[string]string, len(m.Quotas))
		for k, v := range m.Quotas {
			q[k] = v
		}
		out[m.Name] = q
	}
	return out
}

// summarizeModuleRequiresAPIs returns required API surfaces per module.
func summarizeModuleRequiresAPIs(modules []ModuleStatus) map[string][]string {
	out := make(map[string][]string)
	for _, m := range modules {
		if len(m.RequiresAPIs) == 0 {
			continue
		}
		out[m.Name] = append([]string{}, m.RequiresAPIs...)
	}
	return out
}

// summarizeMissingRequiredAPIs returns missing required surfaces per module based on current module APIs.
func summarizeMissingRequiredAPIs(modules []ModuleStatus) map[string][]string {
	available := make(map[string]bool)
	for _, m := range modules {
		for _, api := range m.APIs {
			surf := strings.TrimSpace(string(api.Surface))
			if surf == "" {
				continue
			}
			available[strings.ToLower(surf)] = true
		}
	}
	out := make(map[string][]string)
	for _, m := range modules {
		if len(m.RequiresAPIs) == 0 {
			continue
		}
		for _, req := range m.RequiresAPIs {
			surf := strings.TrimSpace(strings.ToLower(req))
			if surf == "" {
				continue
			}
			if !available[surf] {
				out[m.Name] = append(out[m.Name], surf)
			}
		}
	}
	return out
}

func slowThresholdMSFromEnv() float64 {
	raw := strings.TrimSpace(os.Getenv("MODULE_SLOW_MS"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("MODULE_SLOW_THRESHOLD_MS"))
	}
	if raw == "" {
		return 0
	}
	if v, err := strconv.ParseFloat(raw, 64); err == nil && v > 0 {
		return v
	}
	return 0
}

func (h *handler) resolveSlowThreshold() float64 {
	const fallback = 1000.0
	if h != nil && h.slowMS > 0 {
		return h.slowMS
	}
	if env := slowThresholdMSFromEnv(); env > 0 {
		return env
	}
	return fallback
}
