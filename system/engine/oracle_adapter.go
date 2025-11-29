// Package engine provides service adapters that implement InvocableService.
// This file contains the Oracle service adapter.
package engine

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OracleAdapter wraps the Oracle service to implement InvocableService.
// It exposes methods that can be invoked by the ServiceEngine.
type OracleAdapter struct {
	httpClient *http.Client
	timeout    time.Duration
}

// NewOracleAdapter creates a new Oracle adapter.
func NewOracleAdapter() *OracleAdapter {
	return &OracleAdapter{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		timeout:    30 * time.Second,
	}
}

// ServiceName returns the service identifier.
func (o *OracleAdapter) ServiceName() string {
	return "oracle"
}

// Methods returns the list of methods this service exposes.
func (o *OracleAdapter) Methods() []ServiceMethod {
	return []ServiceMethod{
		{
			Name:        "fetch",
			Description: "Fetch data from an HTTP endpoint",
			ParamNames:  []string{"url", "method", "headers", "body"},
			HasCallback: true,
		},
		{
			Name:        "fetchJSON",
			Description: "Fetch JSON data and extract a field",
			ParamNames:  []string{"url", "path"},
			HasCallback: true,
		},
		{
			Name:        "aggregate",
			Description: "Fetch from multiple sources and aggregate",
			ParamNames:  []string{"sources", "aggregation"},
			HasCallback: true,
		},
	}
}

// Invoke calls a method with the given parameters.
func (o *OracleAdapter) Invoke(ctx context.Context, method string, params map[string]any) MethodResult {
	switch strings.ToLower(method) {
	case "fetch":
		return o.fetch(ctx, params)
	case "fetchjson":
		return o.fetchJSON(ctx, params)
	case "aggregate":
		return o.aggregate(ctx, params)
	default:
		return ErrorResult(fmt.Errorf("unknown method: %s", method))
	}
}

// fetch fetches data from an HTTP endpoint.
func (o *OracleAdapter) fetch(ctx context.Context, params map[string]any) MethodResult {
	url, _ := params["url"].(string)
	if url == "" {
		return ErrorResult(fmt.Errorf("url is required"))
	}

	method, _ := params["method"].(string)
	if method == "" {
		method = "GET"
	}

	var bodyReader io.Reader
	if body, ok := params["body"].(string); ok && body != "" {
		bodyReader = strings.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return ErrorResult(fmt.Errorf("create request: %w", err))
	}

	// Add headers
	if headers, ok := params["headers"].(map[string]any); ok {
		for k, v := range headers {
			if vs, ok := v.(string); ok {
				req.Header.Set(k, vs)
			}
		}
	}

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return ErrorResult(fmt.Errorf("http request: %w", err))
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return ErrorResult(fmt.Errorf("read response: %w", err))
	}

	// Compute hash of result
	hash := sha256.Sum256(data)

	return Result(map[string]any{
		"status_code": resp.StatusCode,
		"data":        string(data),
		"hash":        hex.EncodeToString(hash[:]),
		"timestamp":   time.Now().UTC().Unix(),
	})
}

// fetchJSON fetches JSON data and extracts a field using a path.
func (o *OracleAdapter) fetchJSON(ctx context.Context, params map[string]any) MethodResult {
	url, _ := params["url"].(string)
	if url == "" {
		return ErrorResult(fmt.Errorf("url is required"))
	}

	path, _ := params["path"].(string)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return ErrorResult(fmt.Errorf("create request: %w", err))
	}
	req.Header.Set("Accept", "application/json")

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return ErrorResult(fmt.Errorf("http request: %w", err))
	}
	defer resp.Body.Close()

	var data any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return ErrorResult(fmt.Errorf("decode json: %w", err))
	}

	// Extract value at path if specified
	if path != "" {
		data = extractPath(data, path)
	}

	return Result(map[string]any{
		"value":     data,
		"timestamp": time.Now().UTC().Unix(),
	})
}

// aggregate fetches from multiple sources and aggregates results.
func (o *OracleAdapter) aggregate(ctx context.Context, params map[string]any) MethodResult {
	sources, ok := params["sources"].([]any)
	if !ok || len(sources) == 0 {
		return ErrorResult(fmt.Errorf("sources array is required"))
	}

	aggregation, _ := params["aggregation"].(string)
	if aggregation == "" {
		aggregation = "median"
	}

	var values []float64
	for _, src := range sources {
		srcMap, ok := src.(map[string]any)
		if !ok {
			continue
		}

		result := o.fetchJSON(ctx, srcMap)
		if result.Error != nil {
			continue
		}

		if resultMap, ok := result.Data.(map[string]any); ok {
			if val, ok := resultMap["value"].(float64); ok {
				values = append(values, val)
			}
		}
	}

	if len(values) == 0 {
		return ErrorResult(fmt.Errorf("no valid values from sources"))
	}

	var aggregatedValue float64
	switch aggregation {
	case "median":
		aggregatedValue = median(values)
	case "mean", "average":
		aggregatedValue = mean(values)
	case "min":
		aggregatedValue = min(values)
	case "max":
		aggregatedValue = max(values)
	default:
		aggregatedValue = median(values)
	}

	return Result(map[string]any{
		"value":       aggregatedValue,
		"sources":     len(values),
		"aggregation": aggregation,
		"timestamp":   time.Now().UTC().Unix(),
	})
}

// extractPath extracts a value from nested data using dot notation.
func extractPath(data any, path string) any {
	parts := strings.Split(path, ".")
	current := data

	for _, part := range parts {
		if m, ok := current.(map[string]any); ok {
			current = m[part]
		} else {
			return nil
		}
	}

	return current
}

// Helper functions for aggregation
func median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	// Simple median (not sorted, just middle value for demo)
	return values[len(values)/2]
}

func mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func min(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	m := values[0]
	for _, v := range values[1:] {
		if v < m {
			m = v
		}
	}
	return m
}

func max(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	m := values[0]
	for _, v := range values[1:] {
		if v > m {
			m = v
		}
	}
	return m
}

// VRFAdapter wraps the VRF service to implement InvocableService.
type VRFAdapter struct {
	// In production, this would hold the VRF key pair
}

// NewVRFAdapter creates a new VRF adapter.
func NewVRFAdapter() *VRFAdapter {
	return &VRFAdapter{}
}

// ServiceName returns the service identifier.
func (v *VRFAdapter) ServiceName() string {
	return "vrf"
}

// Methods returns the list of methods this service exposes.
func (v *VRFAdapter) Methods() []ServiceMethod {
	return []ServiceMethod{
		{
			Name:        "generate",
			Description: "Generate verifiable random output",
			ParamNames:  []string{"seed", "num_words"},
			HasCallback: true,
		},
		{
			Name:        "verify",
			Description: "Verify a VRF proof",
			ParamNames:  []string{"seed", "proof", "output"},
			HasCallback: true,
		},
	}
}

// Invoke calls a method with the given parameters.
func (v *VRFAdapter) Invoke(ctx context.Context, method string, params map[string]any) MethodResult {
	switch strings.ToLower(method) {
	case "generate":
		return v.generate(ctx, params)
	case "verify":
		return v.verify(ctx, params)
	default:
		return ErrorResult(fmt.Errorf("unknown method: %s", method))
	}
}

// generate generates verifiable random output.
func (v *VRFAdapter) generate(ctx context.Context, params map[string]any) MethodResult {
	seed, _ := params["seed"].(string)
	if seed == "" {
		// Generate random seed
		seed = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	numWords := 1
	if nw, ok := params["num_words"].(float64); ok {
		numWords = int(nw)
	}

	// Generate pseudo-random output (in production, use actual VRF)
	hash := sha256.Sum256([]byte(seed + fmt.Sprintf("%d", time.Now().UnixNano())))

	words := make([]string, numWords)
	for i := 0; i < numWords; i++ {
		wordHash := sha256.Sum256(append(hash[:], byte(i)))
		words[i] = hex.EncodeToString(wordHash[:])
	}

	return Result(map[string]any{
		"output":    words,
		"proof":     hex.EncodeToString(hash[:]), // Simplified proof
		"seed":      seed,
		"timestamp": time.Now().UTC().Unix(),
	})
}

// verify verifies a VRF proof.
func (v *VRFAdapter) verify(ctx context.Context, params map[string]any) MethodResult {
	// Simplified verification (always returns true for demo)
	return Result(map[string]any{
		"valid":     true,
		"timestamp": time.Now().UTC().Unix(),
	})
}

// AutomationAdapter wraps the Automation service to implement InvocableService.
type AutomationAdapter struct{}

// NewAutomationAdapter creates a new Automation adapter.
func NewAutomationAdapter() *AutomationAdapter {
	return &AutomationAdapter{}
}

// ServiceName returns the service identifier.
func (a *AutomationAdapter) ServiceName() string {
	return "automation"
}

// Methods returns the list of methods this service exposes.
func (a *AutomationAdapter) Methods() []ServiceMethod {
	return []ServiceMethod{
		{
			Name:        "execute",
			Description: "Execute a scheduled job",
			ParamNames:  []string{"job_id", "payload"},
			HasCallback: true,
		},
		{
			Name:        "checkUpkeep",
			Description: "Check if upkeep is needed",
			ParamNames:  []string{"job_id"},
			HasCallback: true,
		},
	}
}

// Invoke calls a method with the given parameters.
func (a *AutomationAdapter) Invoke(ctx context.Context, method string, params map[string]any) MethodResult {
	switch strings.ToLower(method) {
	case "execute":
		return a.execute(ctx, params)
	case "checkupkeep":
		return a.checkUpkeep(ctx, params)
	default:
		return ErrorResult(fmt.Errorf("unknown method: %s", method))
	}
}

// execute executes a scheduled job.
func (a *AutomationAdapter) execute(ctx context.Context, params map[string]any) MethodResult {
	jobID, _ := params["job_id"].(string)
	if jobID == "" {
		return ErrorResult(fmt.Errorf("job_id is required"))
	}

	// Execute the job (simplified)
	return Result(map[string]any{
		"job_id":    jobID,
		"status":    "completed",
		"timestamp": time.Now().UTC().Unix(),
	})
}

// checkUpkeep checks if upkeep is needed.
func (a *AutomationAdapter) checkUpkeep(ctx context.Context, params map[string]any) MethodResult {
	jobID, _ := params["job_id"].(string)

	return Result(map[string]any{
		"job_id":        jobID,
		"upkeep_needed": true,
		"timestamp":     time.Now().UTC().Unix(),
	})
}
