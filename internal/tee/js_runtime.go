package tee

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"math/rand"
	"net/http"
	"net/url"
	"runtime/debug"
	"strings"
	"time"

	"crypto/sha256"
	"encoding/base64"

	"github.com/R3E-Network/service_layer/internal/models"
	"github.com/dop251/goja"
)

// JSRuntime provides a JavaScript runtime environment within the TEE
type JSRuntime struct {
	vm               *goja.Runtime
	memoryLimit      int64 // in MB
	timeoutLimit     int   // in seconds
	secretStore      SecretStore
	memoryLimiter    MemoryLimiter
	objectTracker    *ObjectSizeTracker
	interruptHandler *InterruptHandler

	// Execution-specific state (reset for each execution)
	currentFunctionID string
	currentUserID     int
	executionID       string
}

// SecretStore provides the interface for accessing secrets
type SecretStore interface {
	GetSecret(ctx context.Context, userID int, name string) (string, error)
}

// NewJSRuntime creates a new JavaScript runtime
func NewJSRuntime(memoryLimit int64, timeoutLimit int, secretStore SecretStore) *JSRuntime {
	// Create memory limiter
	memoryLimiter := NewBasicMemoryLimiter(memoryLimit)

	runtime := &JSRuntime{
		vm:            goja.New(),
		memoryLimit:   memoryLimit,
		timeoutLimit:  timeoutLimit,
		secretStore:   secretStore,
		memoryLimiter: memoryLimiter,
	}

	// Create and set the interrupt handler
	runtime.interruptHandler = NewInterruptHandler(runtime)

	// Initialize the runtime
	runtime.initialize()

	return runtime
}

// initialize sets up the JS runtime with required globals and security measures
func (r *JSRuntime) initialize() {
	// Set up memory limits
	r.setupMemoryLimits()

	// Set up runtime options with memory limits
	debug.SetMemoryLimit(r.memoryLimit * 1024 * 1024) // Convert MB to bytes

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

	// Set up object and array tracking
	r.setupObjectTracking()

	// Set up interrupt handler for timeouts
	r.setupInterruptHandler()

	// Set up enhanced object sandbox with additional security measures
	r.setupObjectSandbox()

	// Freeze built-in prototypes
	r.freezeBuiltInPrototypes()
}

// setupMemoryLimits initializes memory limitation components
func (r *JSRuntime) setupMemoryLimits() {
	// Since Goja doesn't directly expose an ArrayBufferAllocator interface,
	// we'll use our object tracker for memory tracking instead.
	// The actual memory limiting will be done through our object and array trackers.
}

// setupObjectTracking initializes object and array size tracking
func (r *JSRuntime) setupObjectTracking() {
	r.objectTracker = NewObjectSizeTracker(r)
	// Setup may fail, but we continue anyway with basic memory protection
	_ = r.objectTracker.Setup()
}

// setupInterruptHandler initializes the interrupt handler for timeouts
func (r *JSRuntime) setupInterruptHandler() {
	if r.interruptHandler != nil {
		r.interruptHandler.Setup()
	}
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

	// Enhanced URL validation - check for suspicious patterns
	if strings.Contains(parsedURL.Host, "--") || strings.Contains(parsedURL.Host, "..") {
		panic(r.vm.ToValue(fmt.Sprintf("Suspicious URL pattern detected: %s", parsedURL.Host)))
	}

	// Check against configurable allowlist of domains
	allowedDomains := []string{
		"api.coinbase.com",
		"api.coingecko.com",
		"api.binance.com",
		"api.crypto.com",
		"api.kraken.com",
		"oracle.neo.org",
	}

	// Add ability to configure domains per function (future enhancement)
	// This would come from function metadata or config

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

	// Enforce rate limits for fetch operations
	// In a future enhancement, this could be tied to a rate limiting service
	// For now, we'll use a simple in-memory counter
	hostKey := parsedURL.Host
	r.enforceRateLimit(hostKey)

	// Get optional request options
	var method string = "GET"
	var headers map[string]string
	var body string
	var timeout int = 10 // Default timeout in seconds

	if len(call.Arguments) > 1 {
		// Parse options object
		optionsObj := call.Arguments[1].ToObject(r.vm)

		// Get method
		if methodVal := optionsObj.Get("method"); methodVal != nil && !goja.IsUndefined(methodVal) && !goja.IsNull(methodVal) {
			method = methodVal.String()
			// Validate method
			validMethods := map[string]bool{
				"GET":     true,
				"POST":    true,
				"PUT":     true,
				"DELETE":  true,
				"HEAD":    true,
				"OPTIONS": true,
			}
			if !validMethods[method] {
				panic(r.vm.ToValue(fmt.Sprintf("Invalid HTTP method: %s", method)))
			}
		}

		// Get headers
		if headersVal := optionsObj.Get("headers"); headersVal != nil && !goja.IsUndefined(headersVal) && !goja.IsNull(headersVal) {
			headersObj := headersVal.ToObject(r.vm)
			headers = make(map[string]string)

			for _, key := range headersObj.Keys() {
				// Validate header keys for security
				if strings.ToLower(key) == "authorization" || strings.ToLower(key) == "cookie" {
					// Allow secure headers only for specific approved domains
					allowSecureHeader := false
					for _, domain := range []string{"oracle.neo.org"} {
						if strings.HasSuffix(parsedURL.Host, domain) {
							allowSecureHeader = true
							break
						}
					}
					if !allowSecureHeader {
						panic(r.vm.ToValue(fmt.Sprintf("Security-sensitive header not allowed for domain: %s", key)))
					}
				}
				headers[key] = headersObj.Get(key).String()
			}
		}

		// Get body
		if bodyVal := optionsObj.Get("body"); bodyVal != nil && !goja.IsUndefined(bodyVal) && !goja.IsNull(bodyVal) {
			// Convert body to string
			if !goja.IsNull(bodyVal) && !goja.IsUndefined(bodyVal) && bodyVal.ToObject(r.vm) != nil && bodyVal.ToObject(r.vm).ClassName() == "Object" {
				// If it's an object, stringify it
				jsonObj := r.vm.Get("JSON").ToObject(r.vm)
				stringify, _ := goja.AssertFunction(jsonObj.Get("stringify"))
				jsonValue, err := stringify(jsonObj, bodyVal)
				if err != nil {
					panic(r.vm.ToValue(fmt.Sprintf("Failed to stringify request body: %v", err)))
				}
				body = jsonValue.String()
			} else {
				body = bodyVal.String()
			}

			// Validate body size (limit to 1MB)
			if len(body) > 1024*1024 {
				panic(r.vm.ToValue("Request body too large (max 1MB)"))
			}
		}

		// Get timeout
		if timeoutVal := optionsObj.Get("timeout"); timeoutVal != nil && !goja.IsUndefined(timeoutVal) && !goja.IsNull(timeoutVal) {
			timeout = int(timeoutVal.ToInteger())
			// Enforce reasonable timeout limits
			if timeout < 1 {
				timeout = 1
			} else if timeout > 30 {
				timeout = 30 // Max 30 seconds
			}
		}
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Second,
	}

	// Create request
	var req *http.Request
	var reqErr error
	if body != "" {
		req, reqErr = http.NewRequest(method, urlStr, strings.NewReader(body))
	} else {
		req, reqErr = http.NewRequest(method, urlStr, nil)
	}

	if reqErr != nil {
		panic(r.vm.ToValue(fmt.Sprintf("Failed to create request: %v", reqErr)))
	}

	// Add headers
	if headers != nil {
		for k, v := range headers {
			req.Header.Add(k, v)
		}
	}

	// Set default content type if not provided and sending a body
	if body != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Add user agent
	req.Header.Set("User-Agent", "Neo-ServiceLayer/1.0")

	// Execute request
	resp, err := client.Do(req)
	if err != nil {
		panic(r.vm.ToValue(fmt.Sprintf("HTTP request failed: %v", err)))
	}
	defer resp.Body.Close()

	// Enforce response size limit (5MB)
	limitedReader := &io.LimitedReader{
		R: resp.Body,
		N: 5 * 1024 * 1024, // 5MB
	}

	// Read response
	respBody, err := ioutil.ReadAll(limitedReader)
	if err != nil {
		if limitedReader.N <= 0 {
			panic(r.vm.ToValue("Response too large (max 5MB)"))
		}
		panic(r.vm.ToValue(fmt.Sprintf("Failed to read response: %v", err)))
	}

	// Extract response headers
	respHeaders := r.vm.NewObject()
	for k, v := range resp.Header {
		if len(v) == 1 {
			respHeaders.Set(k, v[0])
		} else {
			respHeaders.Set(k, v)
		}
	}

	// Create response object
	response := r.vm.NewObject()
	response.Set("status", resp.StatusCode)
	response.Set("statusText", resp.Status)
	response.Set("headers", respHeaders)
	response.Set("ok", resp.StatusCode >= 200 && resp.StatusCode < 300)

	// Parse response body
	responseText := string(respBody)
	response.Set("text", responseText)

	// Try to parse as JSON if content type is application/json
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		jsonObj := r.vm.Get("JSON").ToObject(r.vm)
		parse, _ := goja.AssertFunction(jsonObj.Get("parse"))
		jsonValue, err := parse(jsonObj, r.vm.ToValue(responseText))
		if err == nil {
			response.Set("json", jsonValue)
		}
	}

	// Add json method
	jsonMethod := func(call goja.FunctionCall) goja.Value {
		jsonObj := r.vm.Get("JSON").ToObject(r.vm)
		parse, _ := goja.AssertFunction(jsonObj.Get("parse"))
		jsonValue, err := parse(jsonObj, r.vm.ToValue(responseText))
		if err != nil {
			panic(r.vm.ToValue(fmt.Sprintf("Failed to parse response as JSON: %v", err)))
		}
		return jsonValue
	}
	response.Set("json", r.vm.ToValue(jsonMethod))

	// Add text method
	textMethod := func(call goja.FunctionCall) goja.Value {
		return r.vm.ToValue(responseText)
	}
	response.Set("text", r.vm.ToValue(textMethod))

	return response
}

// enforceRateLimit enforces rate limits for external API calls
func (r *JSRuntime) enforceRateLimit(hostKey string) {
	// This is a placeholder for a more sophisticated rate limiting implementation
	// In a production environment, this would use a distributed rate limiting service
	// For now, we'll just log it and continue
	fmt.Printf("Rate limit check for host: %s\n", hostKey)
}

// validateInputs validates user inputs for safety
func (r *JSRuntime) validateInputs(value goja.Value) error {
	// This is a helper function to recursively validate user inputs
	// In a real implementation, this would check for:
	// - Prototype pollution
	// - Excessively large objects
	// - Suspicious patterns in strings
	// - etc.

	if value == nil || goja.IsNull(value) || goja.IsUndefined(value) {
		return nil
	}

	switch {
	case goja.IsString(value):
		str := value.String()
		if len(str) > 1024*1024 { // 1MB max
			return fmt.Errorf("string too large (max 1MB)")
		}
		// Check for suspicious patterns
		if strings.Contains(str, "<script") || strings.Contains(str, "javascript:") {
			return fmt.Errorf("suspicious pattern in string value")
		}
		return nil

	case !goja.IsNull(value) && !goja.IsUndefined(value) && value.ToObject(r.vm) != nil:
		obj := value.ToObject(r.vm)
		// Check for reasonable object size
		if len(obj.Keys()) > 1000 {
			return fmt.Errorf("object has too many properties (max 1000)")
		}
		// Recursively validate each property
		for _, key := range obj.Keys() {
			if err := r.validateInputs(obj.Get(key)); err != nil {
				return fmt.Errorf("invalid property %s: %v", key, err)
			}
		}
		return nil

	case !goja.IsNull(value) && !goja.IsUndefined(value) && value.ToObject(r.vm) != nil && value.ToObject(r.vm).Get("length") != nil:
		arr := value.ToObject(r.vm)
		length := arr.Get("length").ToInteger()
		if length > 10000 {
			return fmt.Errorf("array too large (max 10000 elements)")
		}
		// Recursively validate each element
		for i := int64(0); i < length; i++ {
			if err := r.validateInputs(arr.Get(fmt.Sprintf("%d", i))); err != nil {
				return fmt.Errorf("invalid array element %d: %v", i, err)
			}
		}
		return nil
	}

	return nil
}

// setupObjectSandbox creates a secure sandbox by limiting access to unsafe APIs
func (r *JSRuntime) setupObjectSandbox() {
	// Run code to create a secure sandbox
	sandboxCode := `
		(function() {
			"use strict";
			
			// Freeze all built-in objects to prevent tampering
			Object.freeze(Object);
			Object.freeze(Array);
			Object.freeze(String);
			Object.freeze(Number);
			Object.freeze(Boolean);
			Object.freeze(Date);
			Object.freeze(Math);
			Object.freeze(JSON);
			Object.freeze(RegExp);
			Object.freeze(Error);
			
			// Prevent access to global object via various techniques
			Object.defineProperty(Object.prototype, "constructor", {
				configurable: false,
				writable: false
			});
			
			// Proxy for array methods to prevent tampering
			const originalArrayProto = Array.prototype;
			
			// Create a deep object inspector to detect dangerous patterns
			window.__inspectObject = function(obj, path = '') {
				if (obj === window) {
					throw new Error('Access to window object not allowed');
				}
				
				if (obj === document || obj === location) {
					throw new Error('Access to browser APIs not allowed');
				}
				
				if (path.length > 10) {
					// Prevent too deep object traversal
					return;
				}
				
				// Prevent access to sensitive objects
				if (typeof obj === 'function' && obj.toString().includes('[native code]')) {
					if (!['Number', 'String', 'Boolean', 'Array', 'Object', 'Date'].includes(obj.name)) {
						throw new Error('Access to native functions not allowed: ' + obj.name);
					}
				}
			};
		})();
	`

	// Execute the sandbox setup
	_, err := r.vm.RunString(sandboxCode)
	if err != nil {
		// Log the error but continue - this is setup code
		fmt.Printf("Error setting up object sandbox: %v\n", err)
	}
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

// generateExecutionID generates a unique execution ID
func generateExecutionID() string {
	return fmt.Sprintf("exec_%d", time.Now().UnixNano())
}

// setupLogger configures the logger to capture logs
func (r *JSRuntime) setupLogger(logs *[]string) {
	console := r.vm.NewObject()

	logFunc := func(call goja.FunctionCall) goja.Value {
		args := make([]interface{}, len(call.Arguments))
		for i, arg := range call.Arguments {
			args[i] = arg.Export()
		}
		logStr := fmt.Sprint(args...)
		*logs = append(*logs, logStr)
		return goja.Undefined()
	}

	console.Set("log", logFunc)
	console.Set("info", logFunc)
	console.Set("warn", logFunc)
	console.Set("error", logFunc)

	r.vm.Set("console", console)
}

// ExecuteFunction executes a JavaScript function within the TEE
func (r *JSRuntime) ExecuteFunction(ctx context.Context, function *models.Function, params map[string]interface{}, userID int) (*models.ExecutionResult, error) {
	// Create a fresh JavaScript VM for each execution to ensure isolation
	r.vm = goja.New()

	// Set execution-specific state
	r.currentFunctionID = fmt.Sprintf("%d", function.ID)
	r.currentUserID = userID
	r.executionID = generateExecutionID()

	// Initialize the runtime with security features
	r.initialize()

	// Set up function-specific context
	r.createExecutionContext()

	// Freeze built-in prototypes to prevent modifications
	r.freezeBuiltInPrototypes()

	// Enable strict sandbox mode
	r.enableStrictSandbox()

	// Set up timeout handling
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(r.timeoutLimit)*time.Second)
	defer cancel()

	// Setup interrupt handler for timeout
	if r.interruptHandler != nil {
		r.interruptHandler.Reset()
		r.interruptHandler.StartInterruptChecker(timeoutCtx)
		defer r.interruptHandler.StopInterruptChecker()
	}

	// Create a slice to store console.log output
	var logs []string
	r.setupLogger(&logs)

	// Validate and set execution variables - added input validation
	if err := r.validateFunctionParams(params); err != nil {
		return &models.ExecutionResult{
			ExecutionID: r.executionID,
			FunctionID:  function.ID,
			Status:      "error",
			StartTime:   time.Now(),
			EndTime:     time.Now(),
			Result:      []byte(fmt.Sprintf("Parameter validation error: %v", err)),
			Logs:        logs,
		}, nil
	}

	r.vm.Set("params", params)

	// Execute the function with proper isolation
	var result interface{}
	var runErr error

	defer func() {
		// Clean up resources when finished
		r.cleanup()
	}()

	// Execute the function, catching panics
	done := make(chan bool, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				if err, ok := r.(error); ok {
					runErr = err
				} else {
					runErr = fmt.Errorf("panic in function execution: %v", r)
				}
			}
			done <- true
		}()

		// Wrap the function in an IIFE (Immediately Invoked Function Expression)
		// to prevent global scope pollution and ensure strict mode
		wrapper := `
		(function() {
			"use strict";
			
			%s
			
			// Verify main function exists
			if (typeof main !== "function") {
				throw new Error("Function must export a main() function");
			}
			
			// Execute main function with parameters
			return main();
		})();
		`

		// Run the source code within the wrapper
		pgm, err := goja.Compile("function", fmt.Sprintf(wrapper, function.SourceCode), false)
		if err != nil {
			runErr = fmt.Errorf("compilation error: %v", err)
			return
		}

		// Execute the function
		res, err := r.vm.RunProgram(pgm)
		if err != nil {
			runErr = err
			return
		}

		// Export the result to Go value
		result = res.Export()

		// Validate the result to ensure it's safe
		if err := r.validateResult(result); err != nil {
			runErr = fmt.Errorf("result validation error: %v", err)
			return
		}
	}()

	// Wait for function to complete or timeout
	select {
	case <-timeoutCtx.Done():
		if r.interruptHandler != nil {
			// Force interrupt the VM to stop execution
			r.interruptHandler.Reset() // Reset immediately to force interruption
		}
		return &models.ExecutionResult{
			ExecutionID: r.executionID,
			FunctionID:  function.ID,
			Status:      "error",
			StartTime:   time.Now(),
			EndTime:     time.Now(),
			Result:      []byte("Function execution timed out"),
			Logs:        logs,
		}, nil
	case <-done:
		// Function completed
	}

	// Handle the execution result
	if runErr != nil {
		return &models.ExecutionResult{
			ExecutionID: r.executionID,
			FunctionID:  function.ID,
			Status:      "error",
			StartTime:   time.Now(),
			EndTime:     time.Now(),
			Result:      []byte(fmt.Sprintf("Execution error: %v", runErr)),
			Logs:        logs,
		}, nil
	}

	// Convert result to JSON
	jsonResult, err := json.Marshal(result)
	if err != nil {
		return &models.ExecutionResult{
			ExecutionID: r.executionID,
			FunctionID:  function.ID,
			Status:      "error",
			StartTime:   time.Now(),
			EndTime:     time.Now(),
			Result:      []byte(fmt.Sprintf("Failed to serialize result: %v", err)),
			Logs:        logs,
		}, nil
	}

	return &models.ExecutionResult{
		ExecutionID: r.executionID,
		FunctionID:  function.ID,
		Status:      "success",
		StartTime:   time.Now(),
		EndTime:     time.Now(),
		Result:      jsonResult,
		Logs:        logs,
	}, nil
}

// createExecutionContext creates an execution context object for the current function
func (r *JSRuntime) createExecutionContext() {
	execContext := r.vm.NewObject()

	// Add execution-specific data
	execContext.Set("functionID", r.currentFunctionID)
	execContext.Set("userID", r.currentUserID)
	execContext.Set("executionID", r.executionID)
	execContext.Set("startTime", time.Now().Unix())

	// Make it available to JavaScript code
	r.vm.Set("executionContext", execContext)
}

// freezeBuiltInPrototypes prevents modifications to built-in prototypes
func (r *JSRuntime) freezeBuiltInPrototypes() {
	// Run code to freeze built-in prototypes
	freezeCode := `
		(function() {
			// Get Object.freeze function
			const freeze = Object.freeze;
			
			// List of built-in prototypes to freeze
			const prototypes = [
				Object.prototype,
				Array.prototype,
				String.prototype,
				Number.prototype,
				Boolean.prototype,
				Function.prototype,
				Date.prototype,
				RegExp.prototype,
				Error.prototype,
				Promise.prototype
			];
			
			// Freeze each prototype
			prototypes.forEach(function(proto) {
				if (proto && typeof proto === 'object') {
					freeze(proto);
				}
			});
		})();
	`

	// Execute the code to freeze prototypes
	_, err := r.vm.RunString(freezeCode)
	if err != nil {
		// Log the error but continue - this is setup code
		fmt.Printf("Error freezing prototypes: %v\n", err)
	}
}

// enableStrictSandbox enables strict mode and adds additional sandboxing
func (r *JSRuntime) enableStrictSandbox() {
	// Run code in strict mode with additional sandboxing
	sandboxCode := `
		(function() {
			"use strict";
			
			// Prevent access to Function constructor
			Object.defineProperty(window, 'Function', {
				value: undefined,
				writable: false,
				configurable: false
			});
			
			// Prevent 'with' statement usage (already prevented in strict mode)
			// Prevent access to global object through constructor chains
			Object.defineProperty(Object.prototype, 'constructor', {
				value: function() {
					throw new Error('Access to constructor is restricted in secure function context');
				},
				writable: false,
				configurable: false
			});
		})();
	`

	// Execute the sandbox setup
	_, err := r.vm.RunString(sandboxCode)
	if err != nil {
		// Log the error but continue - this is setup code
		fmt.Printf("Error setting up sandbox: %v\n", err)
	}
}

// cleanup performs proper cleanup after function execution
func (r *JSRuntime) cleanup() {
	// Clear execution-specific state
	r.currentFunctionID = ""
	r.currentUserID = 0
	r.executionID = ""

	// Force garbage collection to clean up VM resources
	debug.FreeOSMemory()
}

// validateFunctionParams validates function parameters for security
func (r *JSRuntime) validateFunctionParams(params map[string]interface{}) error {
	if params == nil {
		return nil
	}

	// Check overall size
	if len(params) > 100 {
		return fmt.Errorf("too many parameters (max 100)")
	}

	// Validate each parameter
	for key, value := range params {
		// Check key length
		if len(key) > 255 {
			return fmt.Errorf("parameter key too long: %s", key)
		}

		// Convert to goja value for validation
		gojaValue := r.vm.ToValue(value)
		if err := r.validateInputs(gojaValue); err != nil {
			return fmt.Errorf("invalid parameter %s: %v", key, err)
		}
	}

	return nil
}

// validateResult validates the function result for security
func (r *JSRuntime) validateResult(result interface{}) error {
	if result == nil {
		return nil
	}

	// Convert to goja value for validation
	gojaValue := r.vm.ToValue(result)
	return r.validateInputs(gojaValue)
}
