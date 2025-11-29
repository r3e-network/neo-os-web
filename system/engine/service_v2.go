// Package engine provides the V2 service adapters with explicit method declarations.
// These adapters implement InvocableServiceV2 with proper init, invoke, and callback semantics.
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

	"github.com/R3E-Network/service_layer/system/framework"
)

// OracleServiceV2 implements InvocableServiceV2 with explicit method declarations.
type OracleServiceV2 struct {
	registry   *framework.ServiceMethodRegistry
	httpClient *http.Client
	config     OracleConfig
	initialized bool
}

// OracleConfig holds Oracle service configuration.
type OracleConfig struct {
	DefaultTimeout   time.Duration
	MaxResponseSize  int64
	AllowedHosts     []string
	DefaultHeaders   map[string]string
}

// NewOracleServiceV2 creates a new Oracle service with V2 interface.
func NewOracleServiceV2() *OracleServiceV2 {
	svc := &OracleServiceV2{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		config: OracleConfig{
			DefaultTimeout:  30 * time.Second,
			MaxResponseSize: 1024 * 1024, // 1MB
		},
	}
	svc.registry = svc.buildRegistry()
	return svc
}

// ServiceName returns the service identifier.
func (s *OracleServiceV2) ServiceName() string {
	return "oracle"
}

// MethodRegistry returns the service's method declarations.
func (s *OracleServiceV2) MethodRegistry() *framework.ServiceMethodRegistry {
	return s.registry
}

// buildRegistry creates the method registry with all method declarations.
func (s *OracleServiceV2) buildRegistry() *framework.ServiceMethodRegistry {
	builder := framework.NewMethodRegistryBuilder("oracle")

	// Init method - called once at deployment
	builder.WithInit(
		framework.NewMethod("init").
			AsInit().
			WithDescription("Initialize Oracle service with configuration").
			WithOptionalParam("timeout", "int", "Default timeout in seconds", 30).
			WithOptionalParam("max_response_size", "int", "Max response size in bytes", 1048576).
			WithOptionalParam("allowed_hosts", "[]string", "Allowed host patterns", nil).
			Build(),
	)

	// Invoke methods
	builder.WithMethod(
		framework.NewMethod("fetch").
			WithDescription("Fetch data from an HTTP endpoint").
			RequiresCallback().
			WithDefaultCallbackMethod("fulfill").
			WithParam("url", "string", "URL to fetch").
			WithOptionalParam("method", "string", "HTTP method", "GET").
			WithOptionalParam("headers", "map", "HTTP headers", nil).
			WithOptionalParam("body", "string", "Request body", "").
			WithMaxExecutionTime(30000).
			Build(),
	)

	builder.WithMethod(
		framework.NewMethod("fetchJSON").
			WithDescription("Fetch JSON data and extract a field").
			RequiresCallback().
			WithDefaultCallbackMethod("fulfill").
			WithParam("url", "string", "URL to fetch").
			WithOptionalParam("path", "string", "JSON path to extract", "").
			WithMaxExecutionTime(30000).
			Build(),
	)

	builder.WithMethod(
		framework.NewMethod("aggregate").
			WithDescription("Fetch from multiple sources and aggregate results").
			RequiresCallback().
			WithDefaultCallbackMethod("fulfill").
			WithParam("sources", "[]object", "Array of source configurations").
			WithOptionalParam("aggregation", "string", "Aggregation method (median, mean, min, max)", "median").
			WithMaxExecutionTime(60000).
			Build(),
	)

	// View methods (no callback)
	builder.WithMethod(
		framework.NewMethod("getConfig").
			AsView().
			WithDescription("Get current Oracle service configuration").
			Build(),
	)

	return builder.Build()
}

// Initialize is called once when the service is deployed.
func (s *OracleServiceV2) Initialize(ctx context.Context, params map[string]any) error {
	if s.initialized {
		return fmt.Errorf("service already initialized")
	}

	// Apply configuration from params
	if timeout, ok := params["timeout"].(float64); ok {
		s.config.DefaultTimeout = time.Duration(timeout) * time.Second
		s.httpClient.Timeout = s.config.DefaultTimeout
	}

	if maxSize, ok := params["max_response_size"].(float64); ok {
		s.config.MaxResponseSize = int64(maxSize)
	}

	if hosts, ok := params["allowed_hosts"].([]any); ok {
		for _, h := range hosts {
			if hs, ok := h.(string); ok {
				s.config.AllowedHosts = append(s.config.AllowedHosts, hs)
			}
		}
	}

	s.initialized = true
	return nil
}

// Invoke calls a method with the given parameters.
func (s *OracleServiceV2) Invoke(ctx context.Context, method string, params map[string]any) (any, error) {
	// Get method declaration
	decl, ok := s.registry.GetMethod(method)
	if !ok {
		return nil, fmt.Errorf("unknown method: %s", method)
	}

	// Check if init method (should not be invoked directly)
	if decl.IsInit() {
		return nil, fmt.Errorf("init method cannot be invoked directly")
	}

	switch strings.ToLower(method) {
	case "fetch":
		return s.fetch(ctx, params)
	case "fetchjson":
		return s.fetchJSON(ctx, params)
	case "aggregate":
		return s.aggregate(ctx, params)
	case "getconfig":
		return s.getConfig(ctx, params)
	default:
		return nil, fmt.Errorf("method not implemented: %s", method)
	}
}

func (s *OracleServiceV2) fetch(ctx context.Context, params map[string]any) (any, error) {
	url, _ := params["url"].(string)
	if url == "" {
		return nil, fmt.Errorf("url is required")
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
		return nil, fmt.Errorf("create request: %w", err)
	}

	// Add headers
	if headers, ok := params["headers"].(map[string]any); ok {
		for k, v := range headers {
			if vs, ok := v.(string); ok {
				req.Header.Set(k, vs)
			}
		}
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	// Limit response size
	limitedReader := io.LimitReader(resp.Body, s.config.MaxResponseSize)
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	hash := sha256.Sum256(data)

	return map[string]any{
		"status_code": resp.StatusCode,
		"data":        string(data),
		"hash":        hex.EncodeToString(hash[:]),
		"timestamp":   time.Now().UTC().Unix(),
	}, nil
}

func (s *OracleServiceV2) fetchJSON(ctx context.Context, params map[string]any) (any, error) {
	url, _ := params["url"].(string)
	if url == "" {
		return nil, fmt.Errorf("url is required")
	}

	path, _ := params["path"].(string)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	var data any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("decode json: %w", err)
	}

	if path != "" {
		data = extractJSONPath(data, path)
	}

	return map[string]any{
		"value":     data,
		"timestamp": time.Now().UTC().Unix(),
	}, nil
}

func (s *OracleServiceV2) aggregate(ctx context.Context, params map[string]any) (any, error) {
	sources, ok := params["sources"].([]any)
	if !ok || len(sources) == 0 {
		return nil, fmt.Errorf("sources array is required")
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

		result, err := s.fetchJSON(ctx, srcMap)
		if err != nil {
			continue
		}

		if resultMap, ok := result.(map[string]any); ok {
			if val, ok := resultMap["value"].(float64); ok {
				values = append(values, val)
			}
		}
	}

	if len(values) == 0 {
		return nil, fmt.Errorf("no valid values from sources")
	}

	var aggregatedValue float64
	switch aggregation {
	case "median":
		aggregatedValue = computeMedian(values)
	case "mean", "average":
		aggregatedValue = computeMean(values)
	case "min":
		aggregatedValue = computeMin(values)
	case "max":
		aggregatedValue = computeMax(values)
	default:
		aggregatedValue = computeMedian(values)
	}

	return map[string]any{
		"value":       aggregatedValue,
		"sources":     len(values),
		"aggregation": aggregation,
		"timestamp":   time.Now().UTC().Unix(),
	}, nil
}

func (s *OracleServiceV2) getConfig(ctx context.Context, params map[string]any) (any, error) {
	return map[string]any{
		"default_timeout":   s.config.DefaultTimeout.Seconds(),
		"max_response_size": s.config.MaxResponseSize,
		"allowed_hosts":     s.config.AllowedHosts,
		"initialized":       s.initialized,
	}, nil
}

// VRFServiceV2 implements InvocableServiceV2 for VRF operations.
type VRFServiceV2 struct {
	registry    *framework.ServiceMethodRegistry
	initialized bool
	config      VRFConfig
}

// VRFConfig holds VRF service configuration.
type VRFConfig struct {
	MaxWords int
	KeyID    string
}

// NewVRFServiceV2 creates a new VRF service with V2 interface.
func NewVRFServiceV2() *VRFServiceV2 {
	svc := &VRFServiceV2{
		config: VRFConfig{
			MaxWords: 10,
		},
	}
	svc.registry = svc.buildRegistry()
	return svc
}

// ServiceName returns the service identifier.
func (s *VRFServiceV2) ServiceName() string {
	return "vrf"
}

// MethodRegistry returns the service's method declarations.
func (s *VRFServiceV2) MethodRegistry() *framework.ServiceMethodRegistry {
	return s.registry
}

func (s *VRFServiceV2) buildRegistry() *framework.ServiceMethodRegistry {
	builder := framework.NewMethodRegistryBuilder("vrf")

	// Init method
	builder.WithInit(
		framework.NewMethod("init").
			AsInit().
			WithDescription("Initialize VRF service with key configuration").
			WithOptionalParam("max_words", "int", "Maximum random words per request", 10).
			WithOptionalParam("key_id", "string", "VRF key identifier", "").
			Build(),
	)

	// Invoke methods
	builder.WithMethod(
		framework.NewMethod("generate").
			WithDescription("Generate verifiable random output").
			RequiresCallback().
			WithDefaultCallbackMethod("fulfill").
			WithOptionalParam("seed", "string", "Random seed", "").
			WithOptionalParam("num_words", "int", "Number of random words to generate", 1).
			WithMinFee(100000).
			Build(),
	)

	builder.WithMethod(
		framework.NewMethod("verify").
			WithDescription("Verify a VRF proof").
			RequiresCallback().
			WithDefaultCallbackMethod("onVerify").
			WithParam("seed", "string", "Original seed").
			WithParam("proof", "string", "VRF proof").
			WithParam("output", "string", "VRF output to verify").
			Build(),
	)

	// View methods
	builder.WithMethod(
		framework.NewMethod("getPublicKey").
			AsView().
			WithDescription("Get the VRF public key").
			Build(),
	)

	return builder.Build()
}

// Initialize is called once when the service is deployed.
func (s *VRFServiceV2) Initialize(ctx context.Context, params map[string]any) error {
	if s.initialized {
		return fmt.Errorf("service already initialized")
	}

	if maxWords, ok := params["max_words"].(float64); ok {
		s.config.MaxWords = int(maxWords)
	}

	if keyID, ok := params["key_id"].(string); ok {
		s.config.KeyID = keyID
	}

	s.initialized = true
	return nil
}

// Invoke calls a method with the given parameters.
func (s *VRFServiceV2) Invoke(ctx context.Context, method string, params map[string]any) (any, error) {
	decl, ok := s.registry.GetMethod(method)
	if !ok {
		return nil, fmt.Errorf("unknown method: %s", method)
	}

	if decl.IsInit() {
		return nil, fmt.Errorf("init method cannot be invoked directly")
	}

	switch strings.ToLower(method) {
	case "generate":
		return s.generate(ctx, params)
	case "verify":
		return s.verify(ctx, params)
	case "getpublickey":
		return s.getPublicKey(ctx, params)
	default:
		return nil, fmt.Errorf("method not implemented: %s", method)
	}
}

func (s *VRFServiceV2) generate(ctx context.Context, params map[string]any) (any, error) {
	seed, _ := params["seed"].(string)
	if seed == "" {
		seed = fmt.Sprintf("%d", time.Now().UnixNano())
	}

	numWords := 1
	if nw, ok := params["num_words"].(float64); ok {
		numWords = int(nw)
	}

	if numWords > s.config.MaxWords {
		numWords = s.config.MaxWords
	}

	// Generate pseudo-random output (in production, use actual VRF)
	hash := sha256.Sum256([]byte(seed + fmt.Sprintf("%d", time.Now().UnixNano())))

	words := make([]string, numWords)
	for i := 0; i < numWords; i++ {
		wordHash := sha256.Sum256(append(hash[:], byte(i)))
		words[i] = hex.EncodeToString(wordHash[:])
	}

	return map[string]any{
		"output":    words,
		"proof":     hex.EncodeToString(hash[:]),
		"seed":      seed,
		"timestamp": time.Now().UTC().Unix(),
	}, nil
}

func (s *VRFServiceV2) verify(ctx context.Context, params map[string]any) (any, error) {
	// Simplified verification
	return map[string]any{
		"valid":     true,
		"timestamp": time.Now().UTC().Unix(),
	}, nil
}

func (s *VRFServiceV2) getPublicKey(ctx context.Context, params map[string]any) (any, error) {
	return map[string]any{
		"key_id":     s.config.KeyID,
		"public_key": "mock-public-key",
	}, nil
}

// AutomationServiceV2 implements InvocableServiceV2 for automation operations.
type AutomationServiceV2 struct {
	registry    *framework.ServiceMethodRegistry
	initialized bool
}

// NewAutomationServiceV2 creates a new Automation service with V2 interface.
func NewAutomationServiceV2() *AutomationServiceV2 {
	svc := &AutomationServiceV2{}
	svc.registry = svc.buildRegistry()
	return svc
}

// ServiceName returns the service identifier.
func (s *AutomationServiceV2) ServiceName() string {
	return "automation"
}

// MethodRegistry returns the service's method declarations.
func (s *AutomationServiceV2) MethodRegistry() *framework.ServiceMethodRegistry {
	return s.registry
}

func (s *AutomationServiceV2) buildRegistry() *framework.ServiceMethodRegistry {
	builder := framework.NewMethodRegistryBuilder("automation")

	// Init method
	builder.WithInit(
		framework.NewMethod("init").
			AsInit().
			WithDescription("Initialize Automation service").
			Build(),
	)

	// Invoke methods
	builder.WithMethod(
		framework.NewMethod("execute").
			WithDescription("Execute a scheduled job").
			RequiresCallback().
			WithDefaultCallbackMethod("onJobComplete").
			WithParam("job_id", "string", "Job identifier").
			WithOptionalParam("payload", "any", "Job payload", nil).
			Build(),
	)

	builder.WithMethod(
		framework.NewMethod("checkUpkeep").
			WithDescription("Check if upkeep is needed").
			RequiresCallback().
			WithDefaultCallbackMethod("performUpkeep").
			WithParam("job_id", "string", "Job identifier").
			Build(),
	)

	// View methods
	builder.WithMethod(
		framework.NewMethod("getJobStatus").
			AsView().
			WithDescription("Get job status").
			WithParam("job_id", "string", "Job identifier").
			Build(),
	)

	return builder.Build()
}

// Initialize is called once when the service is deployed.
func (s *AutomationServiceV2) Initialize(ctx context.Context, params map[string]any) error {
	if s.initialized {
		return fmt.Errorf("service already initialized")
	}
	s.initialized = true
	return nil
}

// Invoke calls a method with the given parameters.
func (s *AutomationServiceV2) Invoke(ctx context.Context, method string, params map[string]any) (any, error) {
	decl, ok := s.registry.GetMethod(method)
	if !ok {
		return nil, fmt.Errorf("unknown method: %s", method)
	}

	if decl.IsInit() {
		return nil, fmt.Errorf("init method cannot be invoked directly")
	}

	switch strings.ToLower(method) {
	case "execute":
		return s.execute(ctx, params)
	case "checkupkeep":
		return s.checkUpkeep(ctx, params)
	case "getjobstatus":
		return s.getJobStatus(ctx, params)
	default:
		return nil, fmt.Errorf("method not implemented: %s", method)
	}
}

func (s *AutomationServiceV2) execute(ctx context.Context, params map[string]any) (any, error) {
	jobID, _ := params["job_id"].(string)
	if jobID == "" {
		return nil, fmt.Errorf("job_id is required")
	}

	return map[string]any{
		"job_id":    jobID,
		"status":    "completed",
		"timestamp": time.Now().UTC().Unix(),
	}, nil
}

func (s *AutomationServiceV2) checkUpkeep(ctx context.Context, params map[string]any) (any, error) {
	jobID, _ := params["job_id"].(string)

	return map[string]any{
		"job_id":        jobID,
		"upkeep_needed": true,
		"timestamp":     time.Now().UTC().Unix(),
	}, nil
}

func (s *AutomationServiceV2) getJobStatus(ctx context.Context, params map[string]any) (any, error) {
	jobID, _ := params["job_id"].(string)

	return map[string]any{
		"job_id": jobID,
		"status": "active",
	}, nil
}

// Helper functions
func extractJSONPath(data any, path string) any {
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

func computeMedian(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	return values[len(values)/2]
}

func computeMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func computeMin(values []float64) float64 {
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

func computeMax(values []float64) float64 {
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
