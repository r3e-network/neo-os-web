package neorequests

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/tidwall/gjson"

	neorequestsupabase "github.com/r3e-network/neo-miniapp-platform/services/requests/supabase"
)

func (s *Service) executeRNG(ctx context.Context, userID, appID, requestID string, payload []byte) (serviceResult, error) {
	if s.vrfURL == "" {
		return serviceResult{}, fmt.Errorf("neovrf URL not configured")
	}

	var req rngPayload
	if len(payload) > 0 {
		if err := json.Unmarshal(payload, &req); err != nil {
			return serviceResult{}, fmt.Errorf("invalid rng payload")
		}
	}
	vrfRequestID := strings.TrimSpace(req.RequestID)
	if vrfRequestID == "" {
		vrfRequestID = fmt.Sprintf("%s:%s", appID, requestID)
	}

	respBytes, err := s.postJSON(ctx, joinURL(s.vrfURL, "/random"), userID, rngPayload{RequestID: vrfRequestID})
	if err != nil {
		return serviceResult{}, wrapUpstreamServiceError("neovrf", err)
	}

	var resp rngResponse
	if unmarshalErr := json.Unmarshal(respBytes, &resp); unmarshalErr != nil {
		return serviceResult{}, fmt.Errorf("invalid rng response")
	}

	audit := neorequestsupabase.MarshalParams(resp)
	if s.rngMode == "json" {
		return serviceResult{ResultBytes: respBytes, AuditJSON: audit}, nil
	}

	randomnessHex := strings.TrimPrefix(strings.TrimSpace(resp.Randomness), "0x")
	randomnessBytes, err := hex.DecodeString(randomnessHex)
	if err != nil || len(randomnessBytes) == 0 {
		return serviceResult{}, fmt.Errorf("invalid randomness payload")
	}

	return serviceResult{ResultBytes: randomnessBytes, AuditJSON: audit}, nil
}

func (s *Service) executeOracle(ctx context.Context, userID string, payload []byte) (serviceResult, error) {
	if s.oracleURL == "" {
		return serviceResult{}, fmt.Errorf("neooracle URL not configured")
	}
	if len(payload) == 0 {
		return serviceResult{}, fmt.Errorf("oracle payload required")
	}

	var req oraclePayload
	if err := json.Unmarshal(payload, &req); err != nil {
		return serviceResult{}, fmt.Errorf("invalid oracle payload")
	}
	if strings.TrimSpace(req.URL) == "" {
		return serviceResult{}, fmt.Errorf("oracle url required")
	}

	respBytes, err := s.postJSON(ctx, joinURL(s.oracleURL, "/query"), userID, req)
	if err != nil {
		return serviceResult{}, wrapUpstreamServiceError("neooracle", err)
	}

	var resp oracleResponse
	if unmarshalErr := json.Unmarshal(respBytes, &resp); unmarshalErr != nil {
		return serviceResult{}, fmt.Errorf("invalid oracle response")
	}

	var value gjson.Result
	if req.JSONPath != "" {
		value = gjson.Get(resp.Body, req.JSONPath)
		if !value.Exists() {
			return serviceResult{}, fmt.Errorf("json_path not found")
		}
	}

	result := map[string]interface{}{
		"status_code": resp.StatusCode,
		"headers":     resp.Headers,
		"body":        resp.Body,
	}
	if req.JSONPath != "" {
		result = map[string]interface{}{
			"status_code": resp.StatusCode,
			"json_path":   req.JSONPath,
			"value":       value.Value(),
		}
	}
	if resp.Attestation != "" {
		result["attestation"] = resp.Attestation
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		return serviceResult{}, fmt.Errorf("failed to marshal oracle result")
	}

	if s.maxResult > 0 && len(resultBytes) > s.maxResult {
		trimmed := map[string]interface{}{
			"status_code": resp.StatusCode,
		}
		if req.JSONPath != "" {
			trimmed["json_path"] = req.JSONPath
			trimmed["value"] = value.Value()
		} else if resp.Body != "" {
			trimmed["body"] = truncateString(resp.Body, s.maxResult/2)
		}
		if resp.Attestation != "" {
			trimmed["attestation"] = resp.Attestation
		}
		resultBytes, err = json.Marshal(trimmed)
		if err != nil {
			return serviceResult{}, fmt.Errorf("failed to marshal trimmed oracle result")
		}
		if s.maxResult > 0 && len(resultBytes) > s.maxResult {
			return serviceResult{}, fmt.Errorf("oracle result exceeds max size")
		}
		result = trimmed
	}

	return serviceResult{ResultBytes: resultBytes, AuditJSON: neorequestsupabase.MarshalParams(result)}, nil
}

func (s *Service) executeCompute(ctx context.Context, userID, appID string, payload []byte) (serviceResult, error) {
	if s.computeURL == "" {
		return serviceResult{}, fmt.Errorf("neocompute URL not configured")
	}
	if len(payload) == 0 {
		return serviceResult{}, fmt.Errorf("compute payload required")
	}

	var req computePayload
	if err := json.Unmarshal(payload, &req); err != nil {
		return serviceResult{}, fmt.Errorf("invalid compute payload")
	}

	// If script_name is provided, load script from app manifest
	if scriptName := strings.TrimSpace(req.ScriptName); scriptName != "" {
		script, entryPoint, err := s.loadTeeScript(ctx, appID, scriptName)
		if err != nil {
			return serviceResult{}, fmt.Errorf("failed to load TEE script: %w", err)
		}
		req.Script = script
		if req.EntryPoint == "" {
			req.EntryPoint = entryPoint
		}
	}

	if strings.TrimSpace(req.Script) == "" {
		return serviceResult{}, fmt.Errorf("compute script required (provide script_name or script)")
	}
	if strings.TrimSpace(req.EntryPoint) == "" {
		req.EntryPoint = "main"
	}

	respBytes, err := s.postJSON(ctx, joinURL(s.computeURL, "/execute"), userID, req)
	if err != nil {
		return serviceResult{}, wrapUpstreamServiceError("neocompute", err)
	}

	var resp computeResponse
	if unmarshalErr := json.Unmarshal(respBytes, &resp); unmarshalErr != nil {
		return serviceResult{}, fmt.Errorf("invalid compute response")
	}

	if !strings.EqualFold(resp.Status, "completed") {
		if resp.Error != "" {
			return serviceResult{}, errors.New(resp.Error)
		}
		return serviceResult{}, fmt.Errorf("compute failed")
	}

	result := map[string]interface{}{
		"job_id": resp.JobID,
		"status": resp.Status,
		"output": resp.Output,
	}
	if resp.Error != "" {
		result["error"] = resp.Error
	}
	if resp.OutputHash != "" {
		result["output_hash"] = resp.OutputHash
	}
	if resp.Signature != "" {
		result["signature"] = resp.Signature
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		return serviceResult{}, fmt.Errorf("failed to marshal compute result")
	}

	if s.maxResult > 0 && len(resultBytes) > s.maxResult {
		trimmed := map[string]interface{}{
			"job_id": resp.JobID,
			"status": resp.Status,
		}
		if resp.OutputHash != "" {
			trimmed["output_hash"] = resp.OutputHash
		}
		if resp.Signature != "" {
			trimmed["signature"] = resp.Signature
		}
		if resp.Error != "" {
			trimmed["error"] = resp.Error
		}
		resultBytes, err = json.Marshal(trimmed)
		if err != nil {
			return serviceResult{}, fmt.Errorf("failed to marshal trimmed compute result")
		}
		if s.maxResult > 0 && len(resultBytes) > s.maxResult {
			return serviceResult{}, fmt.Errorf("compute result exceeds max size")
		}
		result = trimmed
	}

	return serviceResult{ResultBytes: resultBytes, AuditJSON: neorequestsupabase.MarshalParams(result)}, nil
}

func wrapUpstreamServiceError(serviceName string, err error) error {
	if err == nil {
		return nil
	}

	if isUpstreamTimeoutError(err) {
		return fmt.Errorf("%s service unavailable: %w", serviceName, err)
	}

	statusCode, ok := upstreamStatusCode(err)
	if !ok {
		return err
	}

	switch {
	case statusCode == http.StatusNotFound:
		return fmt.Errorf("%s endpoint not found: %w", serviceName, err)
	case statusCode >= http.StatusBadRequest && statusCode < http.StatusInternalServerError:
		return fmt.Errorf("%s request rejected: %w", serviceName, err)
	case statusCode >= http.StatusInternalServerError:
		return fmt.Errorf("%s service unavailable: %w", serviceName, err)
	default:
		return err
	}
}

func isUpstreamTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var timeoutErr interface{ Timeout() bool }
	return errors.As(err, &timeoutErr) && timeoutErr.Timeout()
}

func upstreamStatusCode(err error) (int, bool) {
	var httpErr *UpstreamHTTPError
	if !errors.As(err, &httpErr) {
		return 0, false
	}
	return httpErr.StatusCode, true
}
