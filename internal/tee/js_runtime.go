package tee

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"crypto/sha256"
	"encoding/base64"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/dop251/goja"
)

// JSRuntime provides a JavaScript runtime environment within the TEE
type JSRuntime struct {
	vm           *goja.Runtime
	memoryLimit  int64 // in MB
	timeoutLimit int   // in seconds
	secretStore  SecretStore
}

// SecretStore provides the interface for accessing secrets
type SecretStore interface {
	GetSecret(ctx context.Context, userID int, name string) (string, error)
}

// NewJSRuntime creates a new JavaScript runtime
func NewJSRuntime(memoryLimit int64, timeoutLimit int, secretStore SecretStore) *JSRuntime {
	runtime := &JSRuntime{
		vm:           goja.New(),
		memoryLimit:  memoryLimit,
		timeoutLimit: timeoutLimit,
		secretStore:  secretStore,
	}

	// Initialize the runtime
	runtime.initialize()

	return runtime
}

// initialize sets up the JS runtime with required globals and security measures
func (r *JSRuntime) initialize() {
	// Set up console.log
	console := r.vm.NewObject()
	console.Set("log", func(call goja.FunctionCall) goja.Value {
		args := make([]interface{}, len(call.Arguments))
		for i, arg := range call.Arguments {
			args[i] = arg.Export()
		}
		fmt.Println(args...)
		return goja.Undefined()
	})

	// Add more console methods
	console.Set("error", func(call goja.FunctionCall) goja.Value {
		args := make([]interface{}, len(call.Arguments))
		for i, arg := range call.Arguments {
			args[i] = arg.Export()
		}
		fmt.Println("ERROR:", args)
		return goja.Undefined()
	})

	console.Set("warn", func(call goja.FunctionCall) goja.Value {
		args := make([]interface{}, len(call.Arguments))
		for i, arg := range call.Arguments {
			args[i] = arg.Export()
		}
		fmt.Println("WARNING:", args)
		return goja.Undefined()
	})

	r.vm.Set("console", console)

	// Create secure fetch implementation
	r.vm.Set("fetch", r.secureFetch)

	// Create secrets API
	secrets := r.vm.NewObject()
	secrets.Set("get", r.secureGetSecret)
	r.vm.Set("secrets", secrets)

	// Add crypto utilities
	r.setupCrypto()

	// Remove unsafe globals
	r.vm.Set("eval", goja.Undefined())
	r.vm.Set("Function", goja.Undefined())
	r.vm.Set("setTimeout", goja.Undefined())
	r.vm.Set("setInterval", goja.Undefined())
	r.vm.Set("clearTimeout", goja.Undefined())
	r.vm.Set("clearInterval", goja.Undefined())

	// Secure versions of timers
	r.setupTimers()
}

// setupTimers sets up secure implementations of setTimeout and setInterval
func (r *JSRuntime) setupTimers() {
	r.vm.Set("setTimeout", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 2 {
			return goja.Undefined()
		}

		fn, ok := goja.AssertFunction(call.Arguments[0])
		if !ok {
			return goja.Undefined()
		}

		delay := call.Arguments[1].ToInteger()
		if delay < 0 {
			delay = 0
		}

		// Cap maximum delay to prevent resource exhaustion
		if delay > 30000 { // 30 seconds max
			delay = 30000
		}

		go func() {
			time.Sleep(time.Duration(delay) * time.Millisecond)
			fn(goja.Undefined())
		}()

		return goja.Undefined()
	})

	// setInterval is not supported for security reasons
	r.vm.Set("setInterval", goja.Undefined())
}

// secureFetch provides a secure implementation of the fetch API
func (r *JSRuntime) secureFetch(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 1 {
		panic(r.vm.ToValue("Fetch requires at least a URL argument"))
	}

	urlStr := call.Arguments[0].String()

	// Validate the URL
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		panic(r.vm.ToValue(fmt.Sprintf("Invalid URL: %v", err)))
	}

	// Only allow https URLs for security
	if parsedURL.Scheme != "https" {
		panic(r.vm.ToValue("Only HTTPS URLs are allowed"))
	}

	// Check against allowlist of domains (this should be configurable)
	// This is a simple implementation - in production, this would be more sophisticated
	allowedDomains := []string{
		"api.coinbase.com",
		"api.coingecko.com",
		"api.binance.com",
		"api.crypto.com",
		"api.kraken.com",
		"oracle.neo.org",
	}

	isAllowed := false
	for _, domain := range allowedDomains {
		if strings.HasSuffix(parsedURL.Host, domain) {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		panic(r.vm.ToValue(fmt.Sprintf("Domain not in allowlist: %s", parsedURL.Host)))
	}

	// Get optional request options
	var options *http.Request
	var method string = "GET"
	var headers map[string]string
	var body string

	if len(call.Arguments) > 1 {
		// Parse options object
		optionsObj := call.Arguments[1].ToObject(r.vm)

		// Get method
		if methodVal := optionsObj.Get("method"); methodVal != nil && !goja.IsUndefined(methodVal) && !goja.IsNull(methodVal) {
			method = methodVal.String()
		}

		// Get headers
		if headersVal := optionsObj.Get("headers"); headersVal != nil && !goja.IsUndefined(headersVal) && !goja.IsNull(headersVal) {
			headersObj := headersVal.ToObject(r.vm)
			headers = make(map[string]string)

			for _, key := range headersObj.Keys() {
				headers[key] = headersObj.Get(key).String()
			}
		}

		// Get body
		if bodyVal := optionsObj.Get("body"); bodyVal != nil && !goja.IsUndefined(bodyVal) && !goja.IsNull(bodyVal) {
			body = bodyVal.String()
		}
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Create request
	req, err := http.NewRequest(method, urlStr, strings.NewReader(body))
	if err != nil {
		panic(r.vm.ToValue(fmt.Sprintf("Failed to create request: %v", err)))
	}

	// Add headers
	if headers != nil {
		for key, value := range headers {
			req.Header.Add(key, value)
		}
	}

	// Add default headers if not present
	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Make the request
	resp, err := client.Do(req)
	if err != nil {
		panic(r.vm.ToValue(fmt.Sprintf("Failed to make request: %v", err)))
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		panic(r.vm.ToValue(fmt.Sprintf("Failed to read response: %v", err)))
	}

	// Create response object
	responseObj := r.vm.NewObject()

	// Basic properties
	responseObj.Set("status", resp.StatusCode)
	responseObj.Set("ok", resp.StatusCode >= 200 && resp.StatusCode < 300)
	responseObj.Set("statusText", resp.Status)

	// Headers
	respHeaders := r.vm.NewObject()
	for key, values := range resp.Header {
		respHeaders.Set(key, strings.Join(values, ", "))
	}
	responseObj.Set("headers", respHeaders)

	// Response body methods
	responseObj.Set("text", func() goja.Value {
		return r.vm.ToValue(string(respBody))
	})

	responseObj.Set("json", func() goja.Value {
		var jsonData interface{}
		if err := json.Unmarshal(respBody, &jsonData); err != nil {
			panic(r.vm.ToValue(fmt.Sprintf("Failed to parse JSON: %v", err)))
		}
		return r.vm.ToValue(jsonData)
	})

	return responseObj
}

// secureGetSecret provides access to secrets in a secure manner
func (r *JSRuntime) secureGetSecret(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 1 {
		panic(r.vm.ToValue("Secret access requires a secret name"))
	}

	secretName := call.Arguments[0].String()

	// Get userID from execution context
	execCtx := r.vm.Get("executionContext")
	if execCtx == nil || goja.IsUndefined(execCtx) || goja.IsNull(execCtx) {
		panic(r.vm.ToValue("Execution context not available"))
	}

	userIDVal := execCtx.ToObject(r.vm).Get("userID")
	if userIDVal == nil || goja.IsUndefined(userIDVal) || goja.IsNull(userIDVal) {
		panic(r.vm.ToValue("User ID not available in execution context"))
	}

	userID := int(userIDVal.ToInteger())

	// Access the secret store to get the actual secret
	secretValue, err := r.secretStore.GetSecret(context.Background(), userID, secretName)
	if err != nil {
		panic(r.vm.ToValue(fmt.Sprintf("Error retrieving secret: %v", err)))
	}

	return r.vm.ToValue(secretValue)
}

// setupCrypto sets up crypto utilities for JavaScript functions
func (r *JSRuntime) setupCrypto() {
	crypto := r.vm.NewObject()

	// Implement basic crypto functions

	// SHA-256 hash function
	crypto.Set("sha256", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			panic(r.vm.ToValue("sha256 requires an input string"))
		}

		input := call.Arguments[0].String()
		hash := sha256.Sum256([]byte(input))
		return r.vm.ToValue(fmt.Sprintf("%x", hash))
	})

	// Generate random bytes
	crypto.Set("randomBytes", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			panic(r.vm.ToValue("randomBytes requires a length parameter"))
		}

		length := int(call.Arguments[0].ToInteger())
		if length <= 0 || length > 1024 {
			panic(r.vm.ToValue("Length must be between 1 and 1024"))
		}

		bytes := make([]byte, length)
		_, err := rand.Read(bytes)
		if err != nil {
			panic(r.vm.ToValue(fmt.Sprintf("Failed to generate random bytes: %v", err)))
		}

		return r.vm.ToValue(base64.StdEncoding.EncodeToString(bytes))
	})

	r.vm.Set("crypto", crypto)
}

// ExecuteFunction executes a JavaScript function in the runtime
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
	// Create a context with timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(r.timeoutLimit)*time.Second)
	defer cancel()

	// Create a channel to receive the result
	resultChan := make(chan *models.ExecutionResult, 1)
	errChan := make(chan error, 1)

	// Execute the function in a goroutine
	go func() {
		startTime := time.Now()

		// Set up the execution environment
		// Create a temporary file for the function code
		tmpFile, err := ioutil.TempFile("", "function-*.js")
		if err != nil {
			errChan <- fmt.Errorf("failed to create temporary function file: %w", err)
			return
		}
		defer os.Remove(tmpFile.Name())

		// Write the function code to the file
		_, err = tmpFile.WriteString(function.Source)
		if err != nil {
			errChan <- fmt.Errorf("failed to write function code: %w", err)
			return
		}

		// Close the file
		err = tmpFile.Close()
		if err != nil {
			errChan <- fmt.Errorf("failed to close function file: %w", err)
			return
		}

		// Create the execution context with user ID
		execCtx := r.vm.NewObject()
		execCtx.Set("userID", userID)
		r.vm.Set("executionContext", execCtx)

		// Convert params to a JavaScript value
		paramsValue, err := r.vm.ToValue(params)
		if err != nil {
			errChan <- fmt.Errorf("failed to convert params: %w", err)
			return
		}

		// Set up logs capture
		logs := []string{}
		logCapture := func(call goja.FunctionCall) goja.Value {
			args := make([]interface{}, len(call.Arguments))
			for i, arg := range call.Arguments {
				args[i] = arg.Export()
			}
			logStr := fmt.Sprint(args...)
			logs = append(logs, logStr)
			return goja.Undefined()
		}

		// Override console.log to capture logs
		console := r.vm.NewObject()
		console.Set("log", logCapture)
		r.vm.Set("console", console)

		// Execute the function
		var result goja.Value
		program, err := goja.Compile(fmt.Sprintf("function_%d", function.ID), function.Source, false)
		if err != nil {
			errChan <- fmt.Errorf("failed to compile function: %w", err)
			return
		}

		_, err = r.vm.RunProgram(program)
		if err != nil {
			errChan <- fmt.Errorf("failed to load function: %w", err)
			return
		}

		// Get the main function
		mainFn, ok := goja.AssertFunction(r.vm.Get("main"))
		if !ok {
			errChan <- errors.New("function does not export a 'main' function")
			return
		}

		// Execute the main function with params
		result, err = mainFn(goja.Undefined(), paramsValue)
		endTime := time.Now()

		if err != nil {
			errChan <- fmt.Errorf("function execution failed: %w", err)
			return
		}

		// Convert the result to JSON
		resultJSON, err := json.Marshal(result.Export())
		if err != nil {
			errChan <- fmt.Errorf("failed to marshal result: %w", err)
			return
		}

		// Create execution result
		executionResult := &models.ExecutionResult{
			ExecutionID: fmt.Sprintf("exec_%d", time.Now().UnixNano()),
			FunctionID:  function.ID,
			Status:      "success",
			StartTime:   startTime,
			EndTime:     endTime,
			Duration:    int(endTime.Sub(startTime).Milliseconds()),
			Result:      resultJSON,
			Logs:        logs,
		}

		resultChan <- executionResult
	}()

	// Wait for the result or timeout
	select {
	case result := <-resultChan:
		return result, nil
	case err := <-errChan:
		return &models.ExecutionResult{
			ExecutionID: fmt.Sprintf("exec_%d", time.Now().UnixNano()),
			FunctionID:  function.ID,
			Status:      "error",
			StartTime:   time.Now(),
			EndTime:     time.Now(),
			Result:      []byte(fmt.Sprintf(`{"error": "%s"}`, err.Error())),
		}, err
	case <-timeoutCtx.Done():
		return &models.ExecutionResult{
			ExecutionID: fmt.Sprintf("exec_%d", time.Now().UnixNano()),
			FunctionID:  function.ID,
			Status:      "timeout",
			StartTime:   time.Now(),
			EndTime:     time.Now(),
			Result:      []byte(`{"error": "function execution timed out"}`),
		}, errors.New("function execution timed out")
	}
}
