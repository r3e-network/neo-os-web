package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/tabwriter"
	"time"
)

func handleStatus(ctx context.Context, client *apiClient, args []string) error {
	fs := flag.NewFlagSet("status", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	surfaceFilter := fs.String("surface", "", "Filter modules by API surface (compute|data|event|store|account|lifecycle|readiness or custom)")
	exportFlag := fs.String("export", "", "Export modules list to file (json|csv|yaml)")
	if err := fs.Parse(args); err != nil {
		return usageError(err)
	}
	if fs.NArg() > 0 {
		return usageError(fmt.Errorf("unexpected args: %v", fs.Args()))
	}

	data, err := client.request(ctx, http.MethodGet, "/system/status", nil)
	if err != nil {
		return err
	}
	var payload struct {
		Status  string `json:"status"`
		Version struct {
			Version   string `json:"version"`
			Commit    string `json:"commit"`
			BuiltAt   string `json:"built_at"`
			GoVersion string `json:"go_version"`
		} `json:"version"`
		ListenAddr string           `json:"listen_addr"`
		Services   []map[string]any `json:"services"`
		JAM        map[string]any   `json:"jam"`
		BusFanout  map[string]struct {
			OK    float64 `json:"ok"`
			Error float64 `json:"error"`
		} `json:"bus_fanout"`
		BusMaxBytes float64 `json:"bus_max_bytes"`
		Modules     []struct {
			Name        string   `json:"name"`
			Domain      string   `json:"domain"`
			Category    string   `json:"category"`
			Interfaces  []string `json:"interfaces"`
			Permissions []string `json:"permissions"`
			Notes       []string `json:"notes"`
			DependsOn   []string `json:"depends_on"`
			Status      string   `json:"status"`
			Error       string   `json:"error"`
			Ready       string   `json:"ready_status"`
			ReadyErr    string   `json:"ready_error"`
			Started     string   `json:"started_at"`
			Stopped     string   `json:"stopped_at"`
			Updated     string   `json:"updated_at"`
			StartNanos  int64    `json:"start_nanos"`
			StopNanos   int64    `json:"stop_nanos"`
			APIs        []struct {
				Name      string `json:"name"`
				Surface   string `json:"surface"`
				Stability string `json:"stability"`
				Summary   string `json:"summary"`
			} `json:"apis"`
		} `json:"modules"`
		ModulesSummary map[string][]string       `json:"modules_summary"`
		ModulesAPISum  map[string][]string       `json:"modules_api_summary"`
		ModulesAPIMeta map[string]map[string]int `json:"modules_api_meta"`
		ModulesMeta    map[string]int            `json:"modules_meta"`
		ModulesTimings map[string]struct {
			StartMS float64 `json:"start_ms"`
			StopMS  float64 `json:"stop_ms"`
		} `json:"modules_timings"`
		ModulesUptime         map[string]float64 `json:"modules_uptime"`
		ModulesSlow           []string           `json:"modules_slow"`
		SlowThreshold         float64            `json:"modules_slow_threshold_ms"`
		ModulesWaitingDeps    []string           `json:"modules_waiting_deps"`
		ModulesWaitingReasons map[string]string  `json:"modules_waiting_reasons"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return fmt.Errorf("decode status payload: %w", err)
	}
	filterSurface := strings.ToLower(strings.TrimSpace(*surfaceFilter))
	exportPath := strings.TrimSpace(*exportFlag)
	filteredModules := make([]struct {
		Name        string   `json:"name"`
		Domain      string   `json:"domain"`
		Category    string   `json:"category"`
		Interfaces  []string `json:"interfaces"`
		Permissions []string `json:"permissions"`
		Notes       []string `json:"notes"`
		DependsOn   []string `json:"depends_on"`
		Status      string   `json:"status"`
		Error       string   `json:"error"`
		Ready       string   `json:"ready_status"`
		ReadyErr    string   `json:"ready_error"`
		Started     string   `json:"started_at"`
		Stopped     string   `json:"stopped_at"`
		Updated     string   `json:"updated_at"`
		StartNanos  int64    `json:"start_nanos"`
		StopNanos   int64    `json:"stop_nanos"`
		APIs        []struct {
			Name      string `json:"name"`
			Surface   string `json:"surface"`
			Stability string `json:"stability"`
			Summary   string `json:"summary"`
		} `json:"apis"`
	}, 0, len(payload.Modules))
	for _, m := range payload.Modules {
		if filterSurface == "" {
			filteredModules = append(filteredModules, m)
			continue
		}
		match := false
		for _, api := range m.APIs {
			surface := strings.ToLower(strings.TrimSpace(api.Surface))
			if surface == "" {
				surface = strings.ToLower(strings.TrimSpace(api.Name))
			}
			if surface == filterSurface {
				match = true
				break
			}
		}
		if match {
			filteredModules = append(filteredModules, m)
		}
	}
	if exportPath != "" {
		if err := exportModules(filteredModules, exportPath); err != nil {
			return fmt.Errorf("export modules: %w", err)
		}
		if exportPath != "-" {
			fmt.Printf("Exported %d modules to %s\n", len(filteredModules), exportPath)
		}
	}
	hasModuleNotes := false
	for _, m := range filteredModules {
		if len(m.Notes) > 0 {
			hasModuleNotes = true
			break
		}
	}
	fmt.Printf("Status: %s\n", payload.Status)
	fmt.Printf("Version: %s (commit %s, built %s, %s)\n", payload.Version.Version, payload.Version.Commit, payload.Version.BuiltAt, payload.Version.GoVersion)
	if strings.TrimSpace(payload.ListenAddr) != "" {
		fmt.Printf("Listen Address: %s\n", payload.ListenAddr)
	}
	if len(payload.JAM) > 0 {
		enabled, _ := payload.JAM["enabled"].(bool)
		store, _ := payload.JAM["store"].(string)
		rate, _ := toInt(payload.JAM["rate_limit_per_min"])
		preimageMax, _ := toInt64(payload.JAM["max_preimage_bytes"])
		pendingMax, _ := toInt(payload.JAM["max_pending_packages"])
		authReq, _ := payload.JAM["auth_required"].(bool)
		legacyList, _ := payload.JAM["legacy_list_response"].(bool)
		accumEnabled, _ := payload.JAM["accumulators_enabled"].(bool)
		accumHash, _ := payload.JAM["accumulator_hash"].(string)
		accumRoots, _ := payload.JAM["accumulator_roots"].([]any)
		fmt.Printf("JAM: enabled=%t", enabled)
		if store != "" {
			fmt.Printf(" store=%s", store)
		}
		if rate > 0 {
			fmt.Printf(" rate_limit_per_min=%d", rate)
		}
		if preimageMax > 0 {
			fmt.Printf(" max_preimage_bytes=%d", preimageMax)
		}
		if pendingMax > 0 {
			fmt.Printf(" max_pending_packages=%d", pendingMax)
		}
		if authReq {
			fmt.Printf(" auth_required=%t", authReq)
		}
		if legacyList {
			fmt.Printf(" legacy_list_response=%t", legacyList)
		}
		if accumEnabled {
			fmt.Printf(" accumulators_enabled=%t", accumEnabled)
		}
		if accumHash != "" {
			fmt.Printf(" accumulator_hash=%s", accumHash)
		}
		fmt.Println()
		if len(accumRoots) > 0 {
			fmt.Println("JAM accumulator_roots:")
			for _, rootVal := range accumRoots {
				root, _ := rootVal.(map[string]any)
				svc, _ := root["service_id"].(string)
				seq, _ := toInt64(root["seq"])
				r, _ := root["root"].(string)
				fmt.Printf("  - %s seq=%d root=%s\n", svc, seq, r)
			}
		}
	}
	if len(payload.BusFanout) > 0 {
		if payload.BusMaxBytes > 0 {
			fmt.Printf("Bus payload cap: %.0f bytes\n", payload.BusMaxBytes)
		}
		fmt.Println("Bus fan-out totals (since start):")
		w := tabwriter.NewWriter(os.Stdout, 0, 8, 2, ' ', 0)
		fmt.Fprintln(w, "KIND\tOK\tERROR")
		kinds := make([]string, 0, len(payload.BusFanout))
		for k := range payload.BusFanout {
			kinds = append(kinds, k)
		}
		sort.Strings(kinds)
		for _, k := range kinds {
			f := payload.BusFanout[k]
			fmt.Fprintf(w, "%s\t%.0f\t%.0f\n", k, f.OK, f.Error)
		}
		_ = w.Flush()
	}
	if len(payload.Services) > 0 {
		fmt.Println("Services:")
		for _, svc := range payload.Services {
			name, _ := svc["Name"].(string)
			domain, _ := svc["Domain"].(string)
			caps, _ := svc["Capabilities"].([]any)
			var capStrings []string
			for _, capVal := range caps {
				if s, ok := capVal.(string); ok {
					capStrings = append(capStrings, s)
				}
			}
			fmt.Printf("  - %s (%s) caps=%s\n", name, domain, strings.Join(capStrings, ","))
		}
	}
	hasPerms := false
	hasAPIs := false
	if len(filteredModules) > 0 {
		for _, m := range filteredModules {
			if len(m.Permissions) > 0 {
				hasPerms = true
			}
			if len(m.APIs) > 0 {
				hasAPIs = true
			}
		}
		fmt.Println("Modules:")
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		switch {
		case hasModuleNotes && hasPerms && hasAPIs:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tAPIS\tPERMS\tSTATUS\tREADY\tERROR\tNOTES")
		case hasModuleNotes && hasPerms:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tPERMS\tSTATUS\tREADY\tERROR\tNOTES")
		case hasModuleNotes && hasAPIs:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tAPIS\tSTATUS\tREADY\tERROR\tNOTES")
		case hasModuleNotes:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tSTATUS\tREADY\tERROR\tNOTES")
		case hasPerms && hasAPIs:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tAPIS\tPERMS\tSTATUS\tREADY\tERROR")
		case hasPerms:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tPERMS\tSTATUS\tREADY\tERROR")
		case hasAPIs:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tAPIS\tSTATUS\tREADY\tERROR")
		default:
			fmt.Fprintln(w, "NAME\tDOMAIN\tCATEGORY\tINTERFACES\tSTATUS\tREADY\tERROR")
		}
		slowSet := map[string]bool{}
		for _, name := range payload.ModulesSlow {
			slowSet[name] = true
		}
		for _, m := range filteredModules {
			ifaces := strings.Join(m.Interfaces, ",")
			apiLabels := func() string {
				if len(m.APIs) == 0 {
					return ""
				}
				out := make([]string, 0, len(m.APIs))
				for _, api := range m.APIs {
					label := api.Surface
					if label == "" {
						label = api.Name
					}
					if api.Stability != "" && api.Stability != "stable" {
						label = label + "(" + api.Stability + ")"
					}
					out = append(out, label)
				}
				return strings.Join(out, ",")
			}()
			perms := strings.Join(m.Permissions, ",")
			status := m.Status
			if slowSet[m.Name] {
				status = status + " (slow)"
			}
			notes := strings.Join(m.Notes, "|")
			switch {
			case hasModuleNotes && hasPerms && hasAPIs:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, apiLabels, perms, status, m.Ready, m.Error, notes)
			case hasModuleNotes && hasPerms:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, perms, status, m.Ready, m.Error, notes)
			case hasModuleNotes && hasAPIs:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, apiLabels, status, m.Ready, m.Error, notes)
			case hasModuleNotes:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, status, m.Ready, m.Error, notes)
			case hasPerms && hasAPIs:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, apiLabels, perms, status, m.Ready, m.Error)
			case hasPerms:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, perms, status, m.Ready, m.Error)
			case hasAPIs:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, apiLabels, status, m.Ready, m.Error)
			default:
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
					m.Name, m.Domain, m.Category, ifaces, status, m.Ready, m.Error)
			}
		}
		_ = w.Flush()
	}
	if len(payload.ModulesMeta) > 0 {
		fmt.Printf("Module summary: total=%d started=%d failed=%d stop_error=%d not_ready=%d\n",
			payload.ModulesMeta["total"], payload.ModulesMeta["started"], payload.ModulesMeta["failed"], payload.ModulesMeta["stop_error"], payload.ModulesMeta["not_ready"])
	}
	if len(payload.ModulesWaitingDeps) > 0 {
		if len(payload.ModulesWaitingReasons) > 0 {
			fmt.Println("Modules waiting for dependencies:")
			for _, name := range payload.ModulesWaitingDeps {
				reason := payload.ModulesWaitingReasons[name]
				if reason == "" {
					reason = "waiting for dependencies"
				}
				fmt.Printf("  - %s: %s\n", name, reason)
			}
		} else {
			fmt.Printf("Modules waiting for dependencies: %s\n", strings.Join(payload.ModulesWaitingDeps, ", "))
		}
	}
	if len(payload.ModulesSlow) > 0 {
		threshold := payload.SlowThreshold
		if threshold <= 0 {
			threshold = 1000
		}
		fmt.Printf("Slow modules (>%.0fms start/stop): %s\n", threshold, strings.Join(payload.ModulesSlow, ", "))
	}
	if len(payload.ModulesTimings) > 0 || len(payload.ModulesUptime) > 0 {
		fmt.Println("Module timings:")
		keys := make([]string, 0, len(payload.ModulesTimings)+len(payload.ModulesUptime))
		seen := map[string]bool{}
		for name := range payload.ModulesTimings {
			keys = append(keys, name)
			seen[name] = true
		}
		for name := range payload.ModulesUptime {
			if !seen[name] {
				keys = append(keys, name)
			}
		}
		sort.Strings(keys)
		for _, name := range keys {
			t := payload.ModulesTimings[name]
			up := payload.ModulesUptime[name]
			line := fmt.Sprintf("  %s:", name)
			if t.StartMS > 0 {
				line += fmt.Sprintf(" start=%.2fms", t.StartMS)
			}
			if t.StopMS > 0 {
				line += fmt.Sprintf(" stop=%.2fms", t.StopMS)
			}
			if up > 0 {
				line += fmt.Sprintf(" uptime=%s", formatSeconds(up))
			}
			fmt.Println(line)
		}
	}
	if len(payload.ModulesSummary) > 0 {
		fmt.Println("Modules summary:")
		for k, v := range payload.ModulesSummary {
			fmt.Printf("  %s: %s\n", k, strings.Join(v, ","))
		}
	}
	if filterSurface != "" {
		fmt.Printf("Module filter: api surface=%s (modules list and degraded view)\n", filterSurface)
	}
	if len(payload.ModulesAPISum) > 0 {
		fmt.Println("Modules by system API:")
		keys := make([]string, 0, len(payload.ModulesAPISum))
		for k := range payload.ModulesAPISum {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			if len(payload.ModulesAPISum[k]) == 0 {
				continue
			}
			line := fmt.Sprintf("  %s: %s", k, strings.Join(payload.ModulesAPISum[k], ","))
			if meta := payload.ModulesAPIMeta[k]; len(meta) > 0 {
				if meta["slow"] > 0 {
					line += fmt.Sprintf(" (slow=%d)", meta["slow"])
				}
			}
			fmt.Println(line)
		}
	}
	if len(filteredModules) > 0 {
		fmt.Println("Modules:")
		for _, mod := range filteredModules {
			status := mod.Status
			if status == "" {
				status = "unknown"
			}
			line := fmt.Sprintf("  - %s", mod.Name)
			if mod.Domain != "" {
				line += fmt.Sprintf(" (%s)", mod.Domain)
			}
			if mod.Category != "" {
				line += fmt.Sprintf(" [%s]", mod.Category)
			}
			if len(mod.Interfaces) > 0 {
				line += fmt.Sprintf(" interfaces=%s", strings.Join(mod.Interfaces, ","))
			}
			if len(mod.Permissions) > 0 {
				line += fmt.Sprintf(" perms=%s", strings.Join(mod.Permissions, ","))
			}
			if len(mod.APIs) > 0 {
				var apiLabels []string
				for _, api := range mod.APIs {
					label := api.Surface
					if label == "" {
						label = api.Name
					}
					if api.Stability != "" && api.Stability != "stable" {
						label = fmt.Sprintf("%s(%s)", label, api.Stability)
					}
					apiLabels = append(apiLabels, label)
				}
				line += fmt.Sprintf(" apis=%s", strings.Join(apiLabels, ","))
			}
			if len(mod.DependsOn) > 0 {
				line += fmt.Sprintf(" deps=%s", strings.Join(mod.DependsOn, ","))
			}
			line += fmt.Sprintf(" status=%s", status)
			if mod.Started != "" {
				line += fmt.Sprintf(" started=%s", mod.Started)
				if up := humanUptime(mod.Started, mod.Stopped, mod.Status); up != "" {
					line += fmt.Sprintf(" uptime=%s", up)
				}
			}
			if len(mod.Notes) > 0 {
				line += fmt.Sprintf(" notes=%s", strings.Join(mod.Notes, "|"))
			}
			if mod.Ready != "" {
				line += fmt.Sprintf(" ready=%s", mod.Ready)
				if mod.ReadyErr != "" {
					line += fmt.Sprintf(" ready_err=%s", mod.ReadyErr)
				}
			}
			if mod.Updated != "" {
				line += fmt.Sprintf(" updated=%s", mod.Updated)
			}
			if mod.Error != "" {
				line += fmt.Sprintf(" err=%s", mod.Error)
			}
			fmt.Println(line)
		}
	}
	return nil
}

func humanUptime(start, stop, status string) string {
	startTime, err := time.Parse(time.RFC3339, start)
	if err != nil {
		return ""
	}
	var end time.Time
	if stop != "" {
		if t, err := time.Parse(time.RFC3339, stop); err == nil {
			end = t
		}
	}
	if end.IsZero() {
		end = time.Now().UTC()
	}
	dur := end.Sub(startTime)
	if dur < 0 {
		return ""
	}
	return dur.Truncate(time.Second).String()
}

func formatSeconds(sec float64) string {
	if sec <= 0 {
		return "0s"
	}
	d := time.Duration(sec * float64(time.Second))
	return d.Truncate(time.Second).String()
}

func exportModules(mods []struct {
	Name        string   `json:"name"`
	Domain      string   `json:"domain"`
	Category    string   `json:"category"`
	Interfaces  []string `json:"interfaces"`
	Permissions []string `json:"permissions"`
	Notes       []string `json:"notes"`
	DependsOn   []string `json:"depends_on"`
	Status      string   `json:"status"`
	Error       string   `json:"error"`
	Ready       string   `json:"ready_status"`
	ReadyErr    string   `json:"ready_error"`
	Started     string   `json:"started_at"`
	Stopped     string   `json:"stopped_at"`
	Updated     string   `json:"updated_at"`
	StartNanos  int64    `json:"start_nanos"`
	StopNanos   int64    `json:"stop_nanos"`
	APIs        []struct {
		Name      string `json:"name"`
		Surface   string `json:"surface"`
		Stability string `json:"stability"`
		Summary   string `json:"summary"`
	} `json:"apis"`
}, path string) error {
	if len(mods) == 0 {
		return fmt.Errorf("no modules to export")
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(path), "."))
	if path == "-" {
		ext = "json"
	}
	if ext == "" {
		ext = "json"
	}
	switch ext {
	case "json":
		b, err := json.MarshalIndent(mods, "", "  ")
		if err != nil {
			return err
		}
		if path == "-" {
			_, err := os.Stdout.Write(b)
			return err
		}
		return os.WriteFile(path, b, 0o644)
	case "yaml", "yml":
		var buf strings.Builder
		buf.WriteString("---\n")
		for _, m := range mods {
			buf.WriteString("- name: " + m.Name + "\n")
			if m.Domain != "" {
				buf.WriteString("  domain: " + m.Domain + "\n")
			}
			if m.Category != "" {
				buf.WriteString("  category: " + m.Category + "\n")
			}
			if len(m.Interfaces) > 0 {
				buf.WriteString("  interfaces: [" + strings.Join(m.Interfaces, ", ") + "]\n")
			}
			if len(m.APIs) > 0 {
				buf.WriteString("  apis:\n")
				for _, api := range m.APIs {
					buf.WriteString("    - name: " + api.Name + "\n")
					if api.Surface != "" {
						buf.WriteString("      surface: " + api.Surface + "\n")
					}
					if api.Stability != "" {
						buf.WriteString("      stability: " + api.Stability + "\n")
					}
					if api.Summary != "" {
						buf.WriteString("      summary: " + api.Summary + "\n")
					}
				}
			}
			if len(m.Permissions) > 0 {
				buf.WriteString("  permissions: [" + strings.Join(m.Permissions, ", ") + "]\n")
			}
			if len(m.DependsOn) > 0 {
				buf.WriteString("  depends_on: [" + strings.Join(m.DependsOn, ", ") + "]\n")
			}
			if m.Status != "" {
				buf.WriteString("  status: " + m.Status + "\n")
			}
			if m.Ready != "" {
				buf.WriteString("  ready: " + m.Ready + "\n")
			}
			if m.Error != "" {
				buf.WriteString("  error: " + m.Error + "\n")
			}
			if m.ReadyErr != "" {
				buf.WriteString("  ready_error: " + m.ReadyErr + "\n")
			}
			if m.Started != "" {
				buf.WriteString("  started_at: " + m.Started + "\n")
			}
			if m.Stopped != "" {
				buf.WriteString("  stopped_at: " + m.Stopped + "\n")
			}
			if m.Updated != "" {
				buf.WriteString("  updated_at: " + m.Updated + "\n")
			}
		}
		if path == "-" {
			_, err := os.Stdout.Write([]byte(buf.String()))
			return err
		}
		return os.WriteFile(path, []byte(buf.String()), 0o644)
	case "csv":
		var b strings.Builder
		// name,domain,category,status,ready,interfaces,apis,perms,depends_on
		b.WriteString("name,domain,category,status,ready,interfaces,apis,permissions,depends_on\n")
		for _, m := range mods {
			apis := make([]string, 0, len(m.APIs))
			for _, api := range m.APIs {
				label := api.Surface
				if label == "" {
					label = api.Name
				}
				if api.Stability != "" && api.Stability != "stable" {
					label = label + "(" + api.Stability + ")"
				}
				apis = append(apis, label)
			}
			row := []string{
				csvEscape(m.Name),
				csvEscape(m.Domain),
				csvEscape(m.Category),
				csvEscape(m.Status),
				csvEscape(m.Ready),
				csvEscape(strings.Join(m.Interfaces, "|")),
				csvEscape(strings.Join(apis, "|")),
				csvEscape(strings.Join(m.Permissions, "|")),
				csvEscape(strings.Join(m.DependsOn, "|")),
			}
			b.WriteString(strings.Join(row, ",") + "\n")
		}
		if path == "-" {
			_, err := os.Stdout.Write([]byte(b.String()))
			return err
		}
		return os.WriteFile(path, []byte(b.String()), 0o644)
	default:
		return fmt.Errorf("unsupported export format %q (use .json, .yaml, .yml, or .csv)", ext)
	}
}

func csvEscape(val string) string {
	if strings.ContainsAny(val, ",\"\n") {
		return "\"" + strings.ReplaceAll(val, "\"", "\"\"") + "\""
	}
	return val
}
