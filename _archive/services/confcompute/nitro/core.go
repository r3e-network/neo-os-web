// Package neocompute provides core logic for the neocompute service.
package neocompute

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/dop251/goja"
	"github.com/google/uuid"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/crypto"
)

// =============================================================================
// Core Logic
// =============================================================================

// Execute runs code inside the TEE enclave and stores the result for later retrieval.
func (s *Service) Execute(ctx context.Context, userID string, req *ExecuteRequest) (*ExecuteResponse, error) {
	startTime := time.Now()
	jobID := uuid.New().String()

	response := &ExecuteResponse{
		JobID:     jobID,
		Status:    "running",
		StartedAt: startTime,
		Logs:      []string{},
	}

	// Validate script
	if req.Script == "" {
		response.Status = "failed"
		response.Error = "script cannot be empty"
		return response, nil
	}

	// Validate input size
	if req.Input != nil {
		inputJSON, err := json.Marshal(req.Input)
		if err != nil {
			response.Status = "failed"
			response.Error = fmt.Sprintf("input is not JSON serializable: %v", err)
			return response, nil
		}
		if len(inputJSON) > MaxInputSize {
			response.Status = "failed"
			response.Error = fmt.Sprintf("input exceeds maximum size of %d bytes", MaxInputSize)
			return response, nil
		}
	}

	// Validate secret refs count
	if len(req.SecretRefs) > MaxSecretRefs {
		response.Status = "failed"
		response.Error = fmt.Sprintf("too many secret references (max %d)", MaxSecretRefs)
		return response, nil
	}

	// Check concurrent jobs limit and increment atomically to prevent TOCTOU race.
	if !s.runningJobs.tryIncrement(userID, MaxConcurrentJobs) {
		response.Status = "failed"
		response.Error = fmt.Sprintf("too many concurrent jobs (max %d)", MaxConcurrentJobs)
		return response, nil
	}
	defer s.runningJobs.decrement(userID)

	// Store an initial "running" snapshot so /jobs shows the job immediately.
	// We store a separate copy to avoid a data race: the local `response` is
	// mutated below while getJob/listJobs may read the stored entry concurrently.
	s.storeJob(userID, &ExecuteResponse{
		JobID:     jobID,
		Status:    "running",
		StartedAt: startTime,
		Logs:      []string{},
	})
	// Re-store the final result on every return path.
	defer func() { s.storeJob(userID, response) }()

	execCtx := ctx
	if _, ok := ctx.Deadline(); !ok {
		timeout := DefaultTimeout
		if req.Timeout > 0 {
			requested := time.Duration(req.Timeout) * time.Second
			if requested < time.Second {
				requested = time.Second
			}
			if requested > 2*time.Minute {
				requested = 2 * time.Minute
			}
			timeout = requested
		}

		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	// Log execution start
	response.Logs = append(response.Logs,
		fmt.Sprintf("[%s] Starting execution", startTime.Format(time.RFC3339)),
		fmt.Sprintf("[%s] Entry point: %s", time.Now().Format(time.RFC3339), req.EntryPoint),
	)

	// Load secrets if referenced
	secrets := make(map[string]string)
	if len(req.SecretRefs) > 0 {
		if s.secretProvider == nil {
			response.Logs = append(response.Logs,
				fmt.Sprintf("[%s] Warning: secret provider not configured; skipping secret injection", time.Now().Format(time.RFC3339)),
			)
		} else {
			for _, ref := range req.SecretRefs {
				secretName := strings.TrimSpace(ref)
				if secretName == "" {
					continue
				}
				// Backward-compatible: allow `secrets:<name>` references.
				if prefix, name, ok := strings.Cut(secretName, ":"); ok {
					prefix = strings.ToLower(strings.TrimSpace(prefix))
					name = strings.TrimSpace(name)
					if name != "" && prefix == "secrets" {
						secretName = name
					}
				}

				secretValue, err := s.secretProvider.GetSecret(execCtx, userID, secretName)
				if err != nil {
					response.Logs = append(response.Logs,
						fmt.Sprintf("[%s] Warning: failed to fetch secret %s: %v", time.Now().Format(time.RFC3339), secretName, err),
					)
					continue
				}
				secrets[secretName] = secretValue
				response.Logs = append(response.Logs,
					fmt.Sprintf("[%s] Loaded secret: %s", time.Now().Format(time.RFC3339), secretName),
				)
			}
		}
	}

	// Execute JavaScript using goja runtime
	output, err := s.executeScript(execCtx, req.Script, req.EntryPoint, req.Input, secrets)
	if err != nil {
		response.Status = "failed"
		response.Error = "script execution failed"
		response.Duration = time.Since(startTime).String()
		return response, nil
	}

	// Validate output size
	if output != nil {
		outputJSON, err := json.Marshal(output)
		if err != nil {
			response.Status = "failed"
			response.Error = "output is not JSON serializable"
			response.Duration = time.Since(startTime).String()
			return response, nil
		}
		if len(outputJSON) > MaxOutputSize {
			response.Status = "failed"
			response.Error = fmt.Sprintf("output exceeds maximum size of %d bytes", MaxOutputSize)
			response.Duration = time.Since(startTime).String()
			return response, nil
		}
	}

	response.Status = "completed"
	response.Output = output
	response.GasUsed = int64(len(req.Script)) * GasPerScriptByte
	response.Duration = time.Since(startTime).String()

	// Encrypt and sign the output if keys are available
	if len(s.masterKey) > 0 && len(output) > 0 {
		if err := s.protectOutput(response); err != nil {
			response.Logs = append(response.Logs,
				fmt.Sprintf("[%s] Warning: failed to protect output: %v", time.Now().Format(time.RFC3339), err),
			)
		}
	}

	response.Logs = append(response.Logs,
		fmt.Sprintf("[%s] Execution completed successfully", time.Now().Format(time.RFC3339)),
	)

	return response, nil
}

// protectOutput encrypts the output and generates a signature to prove TEE origin.
func (s *Service) protectOutput(response *ExecuteResponse) error {
	if len(response.Output) == 0 {
		return nil
	}

	// Serialize output to JSON
	outputJSON, err := json.Marshal(response.Output)
	if err != nil {
		return fmt.Errorf("marshal output: %w", err)
	}

	// Compute hash of plaintext output
	outputHash := crypto.Hash256(outputJSON)
	response.OutputHash = hex.EncodeToString(outputHash)

	// Encrypt the output using master key
	if len(s.masterKey) >= 32 {
		encrypted, err := crypto.Encrypt(s.masterKey[:32], outputJSON)
		if err != nil {
			return fmt.Errorf("encrypt output: %w", err)
		}
		response.EncryptedOutput = base64.StdEncoding.EncodeToString(encrypted)
	}

	// Sign the output hash using signing key (HMAC-SHA256)
	if len(s.signingKey) > 0 {
		signature := crypto.HMACSign(s.signingKey, outputHash)
		response.Signature = hex.EncodeToString(signature)
	}

	if s.Nitro() != nil {
		if report, err := s.Nitro().Attest(outputHash); err == nil && report != nil {
			response.Attestation = report.Document
		}
	}

	return nil
}

// executeScript executes a JavaScript script inside the enclave using goja runtime.
func (s *Service) executeScript(ctx context.Context, script, entryPoint string, input map[string]interface{}, secrets map[string]string) (map[string]interface{}, error) {
	// Validate script size
	if len(script) > MaxScriptSize {
		return nil, fmt.Errorf("script exceeds maximum size of %d bytes", MaxScriptSize)
	}

	// Create goja runtime
	vm := goja.New()

	// Limit recursion depth to prevent stack overflow attacks
	vm.SetMaxCallStackSize(1024)

	// Set up interrupt for timeout
	timeout := DefaultTimeout
	if deadline, ok := ctx.Deadline(); ok {
		timeout = time.Until(deadline)
	}

	done := make(chan struct{})
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("confcompute: timeout goroutine panicked: %v", r)
			}
		}()
		select {
		case <-time.After(timeout):
			vm.Interrupt("execution timeout")
		case <-done:
		}
	}()
	defer close(done)

	// Inject input as global 'input' object
	if input != nil {
		if err := vm.Set("input", input); err != nil {
			return nil, fmt.Errorf("failed to set input: %w", err)
		}
	} else {
		if err := vm.Set("input", map[string]interface{}{}); err != nil {
			return nil, fmt.Errorf("failed to set input: %w", err)
		}
	}

	// Inject secrets as global 'secrets' object (values as strings)
	if err := vm.Set("secrets", secrets); err != nil {
		return nil, fmt.Errorf("failed to set secrets: %w", err)
	}

	// Provide console.log for debugging with limits
	console := vm.NewObject()
	logs := make([]string, 0, MaxLogEntries)
	if err := console.Set("log", func(call goja.FunctionCall) goja.Value {
		// Enforce log entry limit
		if len(logs) >= MaxLogEntries {
			return goja.Undefined()
		}
		args := make([]interface{}, len(call.Arguments))
		for i, arg := range call.Arguments {
			args[i] = arg.Export()
		}
		entry := fmt.Sprint(args...)
		// Enforce log entry size limit
		if len(entry) > MaxLogEntrySize {
			entry = entry[:MaxLogEntrySize] + "...(truncated)"
		}
		// Redact secret values from log output
		for _, secretVal := range secrets {
			if secretVal != "" && strings.Contains(entry, secretVal) {
				entry = strings.ReplaceAll(entry, secretVal, "[REDACTED]")
			}
		}
		logs = append(logs, entry)
		return goja.Undefined()
	}); err != nil {
		return nil, fmt.Errorf("failed to set console.log: %w", err)
	}
	if err := vm.Set("console", console); err != nil {
		return nil, fmt.Errorf("failed to set console: %w", err)
	}

	// Provide crypto utilities
	cryptoObj := vm.NewObject()
	if err := cryptoObj.Set("sha256", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) == 0 {
			return goja.Undefined()
		}
		data := call.Arguments[0].String()
		hash := crypto.Hash256([]byte(data))
		return vm.ToValue(fmt.Sprintf("%x", hash))
	}); err != nil {
		return nil, fmt.Errorf("failed to set crypto.sha256: %w", err)
	}
	if err := cryptoObj.Set("randomBytes", func(call goja.FunctionCall) goja.Value {
		n := 32
		if len(call.Arguments) > 0 {
			n = int(call.Arguments[0].ToInteger())
		}
		if n <= 0 {
			n = 32
		}
		if n > 1024 {
			n = 1024
		}
		bytes, err := crypto.GenerateRandomBytes(n)
		if err != nil {
			return vm.ToValue(map[string]interface{}{"error": err.Error()})
		}
		return vm.ToValue(fmt.Sprintf("%x", bytes))
	}); err != nil {
		return nil, fmt.Errorf("failed to set crypto.randomBytes: %w", err)
	}
	if err := vm.Set("crypto", cryptoObj); err != nil {
		return nil, fmt.Errorf("failed to set crypto: %w", err)
	}

	// Execute the script
	_, err := vm.RunString(script)
	if err != nil {
		return nil, fmt.Errorf("script error: %w", err)
	}

	// Call the entry point function
	entryFn, ok := goja.AssertFunction(vm.Get(entryPoint))
	if !ok {
		return nil, fmt.Errorf("entry point '%s' is not a function", entryPoint)
	}

	result, err := entryFn(goja.Undefined())
	if err != nil {
		return nil, fmt.Errorf("execution error: %w", err)
	}

	// Convert result to map
	output := make(map[string]interface{})
	if result != nil && result != goja.Undefined() && result != goja.Null() {
		exported := result.Export()
		switch v := exported.(type) {
		case map[string]interface{}:
			output = v
		default:
			output["result"] = exported
		}
	}

	// Add logs to output only when no secrets were injected.
	// When secrets are present, suppress console logs entirely to prevent
	// exfiltration via encoding, char-by-char logging, or other bypass techniques.
	if len(secrets) > 0 {
		delete(output, "_logs")
	} else if len(logs) > 0 {
		output["_logs"] = logs
	}

	return output, nil
}

func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
