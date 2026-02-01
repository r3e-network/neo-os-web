package neorequests

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
	"strings"
	"time"

	"github.com/tidwall/gjson"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	txproxytypes "github.com/R3E-Network/neo-miniapps-platform/infrastructure/txproxy/types"
	neorequestsupabase "github.com/R3E-Network/neo-miniapps-platform/services/requests/supabase"
)

type serviceResult struct {
	ResultBytes []byte
	AuditJSON   json.RawMessage
}

func (s *Service) handleServiceRequested(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}
	if s.serviceGatewayAddress != "" && normalizeContractAddress(event.Contract) != s.serviceGatewayAddress {
		return nil
	}

	parsed, err := chain.ParseServiceRequestedEvent(event)
	if err != nil {
		return err
	}

	requestID := strings.TrimSpace(parsed.RequestID)
	appID := strings.TrimSpace(parsed.AppID)
	serviceType := normalizeServiceType(parsed.ServiceType)
	if requestID == "" || appID == "" || serviceType == "" {
		return fmt.Errorf("missing required request fields")
	}

	logger := s.Logger().WithFields(map[string]interface{}{
		"request_id":   requestID,
		"app_id":       appID,
		"service_type": serviceType,
	})

	if s.repo != nil {
		processed, storeErr := s.markEventProcessed(ctx, event, parsed)
		if storeErr != nil {
			logger.WithError(storeErr).Warn("failed to mark event processed")
		}
		if !processed {
			return nil
		}
	}

	s.storeRequestIndex(requestID, appID)
	if storeErr := s.storeContractEvent(ctx, event, &appID, buildServiceRequestedState(parsed)); storeErr != nil {
		logger.WithError(storeErr).Warn("failed to store contract event")
	}

	app, appErr := s.loadMiniApp(ctx, appID)
	if appErr != nil {
		logger.WithError(appErr).Warn("miniapp not found")
		return nil
	}

	if !isAppActive(app.Status) {
		logger.WithError(nil).Warn("miniapp disabled")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, "failed", nil, "miniapp is not active")
		return nil
	}

	if regErr := s.validateAppRegistry(ctx, app); regErr != nil {
		logger.WithError(regErr).Warn("app registry validation failed")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, "failed", nil, regErr.Error())
		return nil
	}

	s.trackMiniAppTx(ctx, appID, "", event)

	manifestInfo, err := parseManifestInfo(app.Manifest, s.chainID)
	if err != nil {
		logger.WithError(err).Warn("invalid manifest")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, "failed", nil, "invalid miniapp manifest")
		return nil
	}

	if !permissionEnabled(manifestInfo.Permissions, serviceTypePermission(serviceType)) {
		logger.WithError(nil).Warn("permission denied")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, "failed", nil, "service permission not granted")
		return nil
	}

	if manifestInfo.CallbackContract != "" || manifestInfo.CallbackMethod != "" {
		if !callbackMatches(manifestInfo, parsed.CallbackContract, parsed.CallbackMethod) {
			logger.WithFields(map[string]interface{}{
				"manifest_callback_contract": manifestInfo.CallbackContract,
				"manifest_callback_method":   manifestInfo.CallbackMethod,
				"request_callback_contract":  parsed.CallbackContract,
				"request_callback_method":    parsed.CallbackMethod,
			}).Warn("callback target mismatch; skipping fulfillment")
			serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
			s.updateServiceRequest(ctx, serviceReq, "failed", nil, "callback target mismatch")
			return nil
		}
	}

	serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)

	result, execErr := s.executeService(ctx, app.DeveloperUserID, appID, requestID, serviceType, parsed.Payload)
	if execErr == nil && len(result.ResultBytes) > s.maxResult {
		execErr = fmt.Errorf("result exceeds max size")
	}

	success := execErr == nil
	fulfillErr := s.fulfillRequest(ctx, parsed, app.DeveloperUserID, result, execErr, serviceReq)
	if fulfillErr != nil {
		logger.WithError(fulfillErr).Warn("callback fulfillment failed")
	}

	if !success {
		logger.WithError(execErr).Warn("service execution failed")
	}

	return nil
}

func (s *Service) handleServiceFulfilled(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}
	if s.serviceGatewayAddress != "" && normalizeContractAddress(event.Contract) != s.serviceGatewayAddress {
		return nil
	}

	parsed, err := chain.ParseServiceFulfilledEvent(event)
	if err != nil {
		return err
	}

	if s.repo != nil {
		processed, err := s.markGenericProcessed(ctx, event, map[string]interface{}{
			"request_id": parsed.RequestID,
		})
		if err != nil {
			s.Logger().WithContext(ctx).WithError(err).Warn("failed to mark service fulfilled event processed")
		}
		if !processed {
			return nil
		}
	}

	appID := s.lookupRequestIndex(parsed.RequestID)
	s.deleteRequestIndex(parsed.RequestID)

	var appPtr *string
	if appID != "" {
		appPtr = &appID
	}
	if storeErr := s.storeContractEvent(ctx, event, appPtr, buildServiceFulfilledState(parsed)); storeErr != nil {
		s.Logger().WithError(storeErr).Warn("failed to store fulfilled event")
	}

	return nil
}

func (s *Service) executeService(ctx context.Context, userID, appID, requestID, serviceType string, payload []byte) (serviceResult, error) {
	// SECURITY: Validate payload size to prevent OOM attacks
	const maxPayloadSize = 1 << 20 // 1MB
	if len(payload) > maxPayloadSize {
		return serviceResult{}, fmt.Errorf("payload too large: %d bytes (max %d)", len(payload), maxPayloadSize)
	}

	switch serviceType {
	case "rng":
		return s.executeRNG(ctx, userID, appID, requestID, payload)
	case "oracle":
		return s.executeOracle(ctx, userID, payload)
	case "compute":
		return s.executeCompute(ctx, userID, appID, payload)
	default:
		return serviceResult{}, fmt.Errorf("unsupported service type: %s", serviceType)
	}
}

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

	respBytes, respErr := s.postJSON(ctx, joinURL(s.vrfURL, "/random"), userID, rngPayload{RequestID: vrfRequestID})
	if respErr != nil {
		return serviceResult{}, respErr
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

	respBytes, respErr := s.postJSON(ctx, joinURL(s.oracleURL, "/query"), userID, req)
	if respErr != nil {
		return serviceResult{}, respErr
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
		script, entryPoint, err := s.loadTeeScript(appID, scriptName)
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
		return serviceResult{}, err
	}

	var resp computeResponse
	if unmarshalErr := json.Unmarshal(respBytes, &resp); unmarshalErr != nil {
		return serviceResult{}, fmt.Errorf("invalid compute response")
	}

	if !strings.EqualFold(resp.Status, "completed") {
		if resp.Error != "" {
			return serviceResult{}, fmt.Errorf("compute execution failed: %s", resp.Error)
		}
		return serviceResult{}, fmt.Errorf("compute execution failed: unknown error (status=%s)", resp.Status)
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

func (s *Service) fulfillRequest(ctx context.Context, req *chain.ServiceRequestedEvent, _ string, result serviceResult, execErr error, serviceReq *neorequestsupabase.ServiceRequest) error {
	if s.txProxy == nil {
		return fmt.Errorf("txproxy not configured")
	}

	success := execErr == nil
	errorMsg := ""
	if execErr != nil {
		errorMsg = sanitizeError(execErr.Error(), s.maxErrorLen)
	}

	params, _, err := buildFulfillParams(req.RequestID, success, result.ResultBytes, errorMsg)
	if err != nil {
		return err
	}

	requestKey := fmt.Sprintf("%s:%s:%s", ServiceID, req.AppID, req.RequestID)
	chainTx := &neorequestsupabase.ChainTx{
		RequestID:       requestKey,
		FromService:     ServiceID,
		TxType:          "service_callback",
		ChainID:         s.chainID,
		ContractAddress: "0x" + s.serviceGatewayAddress,
		MethodName:      "fulfillRequest",
		Params:          neorequestsupabase.MarshalParams(params),
		Status:          "pending",
	}

	if s.repo != nil {
		if repoErr := s.repo.CreateChainTx(ctx, chainTx); repoErr != nil {
			s.Logger().WithContext(ctx).WithError(repoErr).Warn("failed to create chain_txs row")
		} else if serviceReq != nil && chainTx.ID > 0 {
			serviceReq.ChainTxID = &chainTx.ID
			if updateErr := s.repo.UpdateServiceRequest(ctx, serviceReq); updateErr != nil {
				s.Logger().WithError(updateErr).Warn("failed to update service request")
			}
		}
	}

	resp, txErr := s.txProxy.Invoke(ctx, &txproxytypes.InvokeRequest{
		RequestID:       requestKey,
		ContractAddress: "0x" + s.serviceGatewayAddress,
		Method:          "fulfillRequest",
		Params:          params,
		Wait:            s.txWait,
	})
	if txErr != nil {
		chainTx.Status = "failed"
		chainTx.ErrorMessage = sanitizeError(txErr.Error(), s.maxErrorLen)
		if updateErr := s.updateChainTx(ctx, chainTx); updateErr != nil {
			s.Logger().WithError(updateErr).Warn("failed to update chain tx")
		}
		s.updateServiceRequest(ctx, serviceReq, "failed", result.AuditJSON, txErr.Error())
		return txErr
	}

	status := "submitted"
	if s.txWait {
		if strings.EqualFold(resp.VMState, "HALT") {
			status = "confirmed"
		} else {
			status = "failed"
		}
	}

	chainTx.TxHash = resp.TxHash
	chainTx.Status = status
	if resp.Exception != "" && status == "failed" {
		chainTx.ErrorMessage = sanitizeError(resp.Exception, s.maxErrorLen)
	}
	if updateErr := s.updateChainTx(ctx, chainTx); updateErr != nil {
		s.Logger().WithError(updateErr).Warn("failed to update chain tx")
	}

	if serviceReq != nil {
		serviceReq.Status = status
		serviceReq.ChainTxID = &chainTx.ID
		s.updateServiceRequest(ctx, serviceReq, status, result.AuditJSON, "")
	}

	return nil
}

func (s *Service) updateChainTx(ctx context.Context, chainTx *neorequestsupabase.ChainTx) error {
	if s.repo == nil || chainTx == nil || chainTx.ID == 0 {
		return nil
	}
	return s.repo.UpdateChainTx(ctx, chainTx)
}

func (s *Service) updateServiceRequest(ctx context.Context, req *neorequestsupabase.ServiceRequest, status string, result json.RawMessage, errMsg string) {
	if s.repo == nil || req == nil {
		return
	}
	if status != "" {
		req.Status = status
	}
	if len(result) > 0 {
		req.Result = result
	}
	if errMsg != "" {
		req.Error = sanitizeError(errMsg, s.maxErrorLen)
	}
	req.CompletedAt = ptrTime(time.Now().UTC())
	if updateErr := s.repo.UpdateServiceRequest(ctx, req); updateErr != nil {
		s.Logger().WithError(updateErr).Warn("failed to update service request")
	}
}

func (s *Service) createServiceRequest(ctx context.Context, app *neorequestsupabase.MiniApp, parsed *chain.ServiceRequestedEvent, serviceType string) *neorequestsupabase.ServiceRequest {
	if s.repo == nil || app == nil {
		return nil
	}

	payloadAudit := map[string]interface{}{
		"request_id":        parsed.RequestID,
		"app_id":            parsed.AppID,
		"service_type":      serviceType,
		"requester":         parsed.Requester,
		"callback_contract": parsed.CallbackContract,
		"callback_method":   parsed.CallbackMethod,
		"payload":           decodePayload(parsed.Payload),
	}

	req := &neorequestsupabase.ServiceRequest{
		UserID:      app.DeveloperUserID,
		ChainID:     s.chainID,
		ServiceType: serviceType,
		Status:      "processing",
		Payload:     neorequestsupabase.MarshalParams(payloadAudit),
	}

	if err := s.repo.CreateServiceRequest(ctx, req); err != nil {
		s.Logger().WithContext(ctx).WithError(err).Warn("failed to persist service request")
		return nil
	}
	return req
}

func (s *Service) loadMiniApp(ctx context.Context, appID string) (*neorequestsupabase.MiniApp, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	appID = strings.TrimSpace(appID)
	if appID == "" {
		return nil, fmt.Errorf("app_id cannot be empty")
	}
	if app, ok, notFound := s.getMiniAppCached(miniAppCacheKey("app:", "", appID)); ok {
		if notFound {
			return nil, miniAppNotFoundError(appID)
		}
		return app, nil
	}

	app, err := s.repo.GetMiniApp(ctx, appID)
	if err != nil {
		if database.IsNotFound(err) {
			s.cacheMiniAppNotFound(appID, "")
		}
		return nil, err
	}

	contractAddress := appContractAddress(app, s.chainID)
	s.cacheMiniApp(app, contractAddress)
	return app, nil
}

func (s *Service) loadMiniAppByContractAddress(ctx context.Context, contractAddress string) (*neorequestsupabase.MiniApp, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	normalized := normalizeContractAddress(contractAddress)
	if normalized == "" {
		return nil, fmt.Errorf("contract_address cannot be empty")
	}
	if app, ok, notFound := s.getMiniAppCached(miniAppCacheKey("contract:", s.chainID, normalized)); ok {
		if notFound {
			return nil, miniAppNotFoundError(normalized)
		}
		return app, nil
	}

	app, err := s.repo.GetMiniAppByContractAddress(ctx, s.chainID, normalized)
	if err != nil {
		if database.IsNotFound(err) {
			s.cacheMiniAppNotFound("", normalized)
		}
		return nil, err
	}

	s.cacheMiniApp(app, normalized)
	return app, nil
}

func (s *Service) markEventProcessed(ctx context.Context, event *chain.ContractEvent, parsed *chain.ServiceRequestedEvent) (bool, error) {
	if s.repo == nil || event == nil || parsed == nil {
		return true, nil
	}

	payload := map[string]interface{}{
		"request_id":        parsed.RequestID,
		"app_id":            parsed.AppID,
		"service_type":      parsed.ServiceType,
		"callback_contract": parsed.CallbackContract,
		"callback_method":   parsed.CallbackMethod,
	}

	processed := &neorequestsupabase.ProcessedEvent{
		ChainID:         s.chainID,
		TxHash:          event.TxHash,
		LogIndex:        event.LogIndex,
		BlockHeight:     event.BlockIndex,
		BlockHash:       event.BlockHash,
		ContractAddress: event.Contract,
		EventName:       event.EventName,
		Payload:         neorequestsupabase.MarshalParams(payload),
	}

	return s.repo.MarkProcessedEvent(ctx, processed)
}

func (s *Service) storeContractEvent(ctx context.Context, event *chain.ContractEvent, appID *string, state json.RawMessage) error {
	if s.repo == nil || event == nil {
		return nil
	}

	record := &neorequestsupabase.ContractEvent{
		ChainID:         s.chainID,
		TxHash:          event.TxHash,
		BlockIndex:      event.BlockIndex,
		ContractAddress: event.Contract,
		EventName:       event.EventName,
		AppID:           appID,
		State:           state,
	}

	return s.repo.CreateContractEvent(ctx, record)
}

func buildFulfillParams(requestID string, success bool, result []byte, errorMsg string) ([]chain.ContractParam, *big.Int, error) {
	requestInt := new(big.Int)
	if _, ok := requestInt.SetString(strings.TrimSpace(requestID), 10); !ok {
		return nil, nil, fmt.Errorf("invalid request_id")
	}

	if result == nil {
		result = []byte{}
	}

	params := []chain.ContractParam{
		chain.NewIntegerParam(requestInt),
		chain.NewBoolParam(success),
		chain.NewByteArrayParam(result),
		chain.NewStringParam(errorMsg),
	}

	return params, requestInt, nil
}

func buildServiceRequestedState(event *chain.ServiceRequestedEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	state := map[string]interface{}{
		"request_id":        event.RequestID,
		"app_id":            event.AppID,
		"service_type":      event.ServiceType,
		"requester":         event.Requester,
		"callback_contract": event.CallbackContract,
		"callback_method":   event.CallbackMethod,
		"payload":           decodePayload(event.Payload),
	}
	return neorequestsupabase.MarshalParams(state)
}

func buildServiceFulfilledState(event *chain.ServiceFulfilledEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	state := map[string]interface{}{
		"request_id": event.RequestID,
		"success":    event.Success,
		"result":     decodeResult(event.Result),
		"error":      event.Error,
	}
	return neorequestsupabase.MarshalParams(state)
}

func buildNotificationState(event *chain.MiniAppNotificationEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	state := map[string]interface{}{
		"app_id":            event.AppID,
		"title":             event.Title,
		"content":           event.Content,
		"notification_type": event.NotificationType,
		"priority":          event.Priority,
	}
	return neorequestsupabase.MarshalParams(state)
}

func buildMetricState(event *chain.MiniAppMetricEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	value := ""
	if event.Value != nil {
		value = event.Value.String()
	}
	state := map[string]interface{}{
		"app_id":      event.AppID,
		"metric_name": event.MetricName,
		"value":       value,
	}
	return neorequestsupabase.MarshalParams(state)
}

func decodePayload(payload []byte) interface{} {
	if len(payload) == 0 {
		return nil
	}
	var parsed interface{}
	if err := json.Unmarshal(payload, &parsed); err == nil {
		return parsed
	}
	return map[string]string{"base64": base64.StdEncoding.EncodeToString(payload)}
}

func decodeResult(result []byte) interface{} {
	if len(result) == 0 {
		return nil
	}
	var parsed interface{}
	if err := json.Unmarshal(result, &parsed); err == nil {
		return parsed
	}
	return map[string]string{"hex": hex.EncodeToString(result)}
}

func serviceTypePermission(serviceType string) string {
	switch serviceType {
	case "rng":
		return "rng"
	case "oracle":
		return "oracle"
	case "compute":
		return "compute"
	default:
		return serviceType
	}
}

func normalizeServiceType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "rng", "neovrf", "vrf":
		return "rng"
	case "oracle", "neooracle":
		return "oracle"
	case "compute", "neocompute", "confcompute":
		return "compute"
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

type manifestInfo struct {
	CallbackContract string
	CallbackMethod   string
	Permissions      map[string]interface{}
	NewsIntegration  *bool
}

func parseManifestInfo(raw json.RawMessage, chainID string) (manifestInfo, error) {
	out := manifestInfo{Permissions: map[string]interface{}{}}
	if len(raw) == 0 {
		return out, nil
	}

	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return out, err
	}

	if _, ok := m["callback_contract"]; ok {
		return out, fmt.Errorf("manifest.callback_contract is no longer supported")
	}
	if _, ok := m["callback_method"]; ok {
		return out, fmt.Errorf("manifest.callback_method is no longer supported")
	}

	if chainID != "" {
		if contractsRaw, ok := m["contracts"]; ok {
			if contractsMap, ok := contractsRaw.(map[string]interface{}); ok {
				if entryRaw, ok := contractsMap[chainID]; ok {
					if entryMap, ok := entryRaw.(map[string]interface{}); ok {
						if callbackRaw, ok := entryMap["callback"]; ok {
							callbackMap, ok := callbackRaw.(map[string]interface{})
							if !ok {
								return out, fmt.Errorf("manifest.contracts.%s.callback must be an object", chainID)
							}
							addrVal, addrOk := callbackMap["address"]
							methodVal, methodOk := callbackMap["method"]
							if addrOk || methodOk {
								if !addrOk || !methodOk {
									return out, fmt.Errorf("manifest.contracts.%s.callback requires address and method", chainID)
								}
								normalized := normalizeContractAddress(fmt.Sprintf("%v", addrVal))
								if normalized == "" {
									return out, fmt.Errorf("invalid callback address for %s", chainID)
								}
								out.CallbackContract = "0x" + normalized
								out.CallbackMethod = strings.TrimSpace(fmt.Sprintf("%v", methodVal))
							}
						}
					}
				}
			}
		}
	}

	if perms, ok := m["permissions"]; ok {
		switch v := perms.(type) {
		case map[string]interface{}:
			out.Permissions = v
		case []interface{}:
			for _, entry := range v {
				key := strings.ToLower(strings.TrimSpace(fmt.Sprintf("%v", entry)))
				if key != "" {
					out.Permissions[key] = true
				}
			}
		}
	}

	if val, ok := m["news_integration"]; ok {
		if enabled, ok := val.(bool); ok {
			out.NewsIntegration = &enabled
		}
	}

	return out, nil
}

func manifestContractAddress(raw json.RawMessage, chainID string) string {
	if len(raw) == 0 {
		return ""
	}

	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return ""
	}

	if chainID != "" {
		if contractsRaw, ok := m["contracts"]; ok {
			if contractsMap, ok := contractsRaw.(map[string]interface{}); ok {
				if entryRaw, ok := contractsMap[chainID]; ok {
					if entryMap, ok := entryRaw.(map[string]interface{}); ok {
						if addrVal, ok := entryMap["address"]; ok && addrVal != nil {
							return normalizeContractAddress(fmt.Sprintf("%v", addrVal))
						}
					}
				}
			}
		}
	}

	return ""
}

func appContractAddress(app *neorequestsupabase.MiniApp, chainID string) string {
	if app == nil {
		return ""
	}
	if normalized := contractsContractAddress(app.Contracts, chainID); normalized != "" {
		return normalized
	}
	return manifestContractAddress(app.Manifest, chainID)
}

func contractsContractAddress(raw json.RawMessage, chainID string) string {
	if len(raw) == 0 || chainID == "" {
		return ""
	}
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return ""
	}
	entryRaw, ok := m[chainID]
	if !ok {
		return ""
	}
	entryMap, ok := entryRaw.(map[string]interface{})
	if !ok {
		return ""
	}
	addrVal, addrOk := entryMap["address"]
	if !addrOk || addrVal == nil {
		return ""
	}
	return normalizeContractAddress(fmt.Sprintf("%v", addrVal))
}

func permissionEnabled(perms map[string]interface{}, key string) bool {
	if len(perms) == 0 || key == "" {
		return false
	}
	value, ok := perms[key]
	if !ok {
		return false
	}
	switch v := value.(type) {
	case bool:
		return v
	case []interface{}:
		return len(v) > 0
	default:
		return false
	}
}

func callbackMatches(info manifestInfo, contract, method string) bool {
	if info.CallbackContract == "" && info.CallbackMethod == "" {
		return true
	}
	if info.CallbackMethod != "" && info.CallbackMethod != strings.TrimSpace(method) {
		return false
	}
	if info.CallbackContract != "" {
		if normalizeContractAddress(info.CallbackContract) != normalizeContractAddress(contract) {
			return false
		}
	}
	return true
}

func isAppActive(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "active")
}

func sanitizeError(msg string, limit int) string {
	msg = strings.ReplaceAll(msg, "\n", " ")
	msg = strings.TrimSpace(msg)
	if limit <= 0 || len(msg) <= limit {
		return msg
	}
	return msg[:limit]
}

func truncateString(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

func (s *Service) handleNotificationEvent(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}

	parsed, err := chain.ParseMiniAppNotificationEvent(event)
	if err != nil {
		return nil // Skip non-notification events
	}

	logger := s.Logger().WithFields(map[string]interface{}{
		"app_id": parsed.AppID,
		"title":  parsed.Title,
	})

	if s.repo != nil {
		var processed bool
		processed, err = s.markNotificationProcessed(ctx, event, parsed)
		if err != nil {
			logger.WithContext(ctx).WithError(err).Warn("failed to mark notification event processed")
		}
		if !processed {
			return nil
		}
	}

	if s.repo != nil {
		var app *neorequestsupabase.MiniApp
		var loadErr error
		if strings.TrimSpace(parsed.AppID) != "" {
			app, loadErr = s.loadMiniApp(ctx, parsed.AppID)
		} else if strings.TrimSpace(event.Contract) != "" {
			app, loadErr = s.loadMiniAppByContractAddress(ctx, event.Contract)
			if loadErr == nil && app != nil {
				parsed.AppID = app.AppID
				logger = s.Logger().WithFields(map[string]interface{}{
					"app_id": parsed.AppID,
					"title":  parsed.Title,
				})
			}
		}
		switch {
		case loadErr != nil && database.IsNotFound(loadErr):
			return nil
		case loadErr != nil:
			logger.WithContext(ctx).WithError(loadErr).Warn("failed to load miniapp manifest")
		case app != nil && !isAppActive(app.Status):
			return nil
		case app != nil && s.enforceAppRegistry:
			if regErr := s.validateAppRegistry(ctx, app); regErr != nil {
				logger.WithContext(ctx).WithError(regErr).Warn("app registry validation failed")
				return nil
			}
		case app != nil:
			info, parseErr := parseManifestInfo(app.Manifest, s.chainID)
			if parseErr == nil && info.NewsIntegration != nil && !*info.NewsIntegration {
				return nil
			}
			if contractAddress := appContractAddress(app, s.chainID); contractAddress != "" {
				if normalizeContractAddress(event.Contract) != contractAddress {
					logger.WithContext(ctx).Warn("miniapp contract address mismatch")
					return nil
				}
			} else if s.requireManifestContract {
				logger.WithContext(ctx).Warn("contract_address missing; notification rejected")
				return nil
			}
		default:
			return nil
		}
	}

	s.trackMiniAppTx(ctx, parsed.AppID, "", event)
	if storeErr := s.storeContractEvent(ctx, event, &parsed.AppID, buildNotificationState(parsed)); storeErr != nil {
		s.Logger().WithError(storeErr).Warn("failed to store notification event")
	}

	// Store notification in database via repository
	err = s.repo.CreateNotification(ctx, &neorequestsupabase.Notification{
		AppID:            parsed.AppID,
		ChainID:          s.chainID,
		Title:            parsed.Title,
		Content:          parsed.Content,
		NotificationType: parsed.NotificationType,
		Source:           "contract",
		TxHash:           event.TxHash,
		BlockNumber:      safeInt64(event.BlockIndex),
		Priority:         parsed.Priority,
	})

	if err != nil {
		logger.WithError(err).Error("failed to store notification")
		return err
	}

	logger.Info("notification stored from contract event")
	return nil
}

func (s *Service) handleMetricEvent(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}

	parsed, err := chain.ParseMiniAppMetricEvent(event)
	if err != nil {
		return nil
	}

	logger := s.Logger().WithFields(map[string]interface{}{
		"app_id":      parsed.AppID,
		"metric_name": parsed.MetricName,
	})

	if s.repo != nil {
		processed, err := s.markMetricProcessed(ctx, event, parsed)
		if err != nil {
			logger.WithContext(ctx).WithError(err).Warn("failed to mark metric event processed")
		}
		if !processed {
			return nil
		}
	}

	if s.repo != nil {
		var app *neorequestsupabase.MiniApp
		var loadErr error
		if strings.TrimSpace(parsed.AppID) != "" {
			app, loadErr = s.loadMiniApp(ctx, parsed.AppID)
		} else if strings.TrimSpace(event.Contract) != "" {
			app, loadErr = s.loadMiniAppByContractAddress(ctx, event.Contract)
			if loadErr == nil && app != nil {
				parsed.AppID = app.AppID
				logger = s.Logger().WithFields(map[string]interface{}{
					"app_id":      parsed.AppID,
					"metric_name": parsed.MetricName,
				})
			}
		}
		switch {
		case loadErr != nil && database.IsNotFound(loadErr):
			return nil
		case loadErr != nil:
			logger.WithContext(ctx).WithError(loadErr).Warn("failed to load miniapp manifest")
		case app != nil && !isAppActive(app.Status):
			return nil
		case app != nil && s.enforceAppRegistry:
			if regErr := s.validateAppRegistry(ctx, app); regErr != nil {
				logger.WithContext(ctx).WithError(regErr).Warn("app registry validation failed")
				return nil
			}
		case app != nil:
			if contractAddress := appContractAddress(app, s.chainID); contractAddress != "" {
				if normalizeContractAddress(event.Contract) != contractAddress {
					logger.WithContext(ctx).Warn("miniapp contract address mismatch")
					return nil
				}
			} else if s.requireManifestContract {
				logger.WithContext(ctx).Warn("contract_address missing; metric rejected")
				return nil
			}
		default:
			return nil
		}
		s.trackMiniAppTx(ctx, parsed.AppID, "", event)
		if storeErr := s.storeContractEvent(ctx, event, &parsed.AppID, buildMetricState(parsed)); storeErr != nil {
			s.Logger().WithError(storeErr).Warn("failed to store metric event")
		}
	}

	return nil
}

func (s *Service) markNotificationProcessed(ctx context.Context, event *chain.ContractEvent, parsed *chain.MiniAppNotificationEvent) (bool, error) {
	if s.repo == nil || event == nil || parsed == nil {
		return true, nil
	}

	payload := map[string]interface{}{
		"app_id":            parsed.AppID,
		"title":             parsed.Title,
		"content":           parsed.Content,
		"notification_type": parsed.NotificationType,
		"priority":          parsed.Priority,
	}

	processed := &neorequestsupabase.ProcessedEvent{
		ChainID:         s.chainID,
		TxHash:          event.TxHash,
		LogIndex:        event.LogIndex,
		BlockHeight:     event.BlockIndex,
		BlockHash:       event.BlockHash,
		ContractAddress: event.Contract,
		EventName:       event.EventName,
		Payload:         neorequestsupabase.MarshalParams(payload),
	}

	return s.repo.MarkProcessedEvent(ctx, processed)
}

func (s *Service) markGenericProcessed(ctx context.Context, event *chain.ContractEvent, payload map[string]interface{}) (bool, error) {
	if s.repo == nil || event == nil {
		return true, nil
	}

	processed := &neorequestsupabase.ProcessedEvent{
		ChainID:         s.chainID,
		TxHash:          event.TxHash,
		LogIndex:        event.LogIndex,
		BlockHeight:     event.BlockIndex,
		BlockHash:       event.BlockHash,
		ContractAddress: event.Contract,
		EventName:       event.EventName,
		Payload:         neorequestsupabase.MarshalParams(payload),
	}

	return s.repo.MarkProcessedEvent(ctx, processed)
}

func (s *Service) markMetricProcessed(ctx context.Context, event *chain.ContractEvent, parsed *chain.MiniAppMetricEvent) (bool, error) {
	if s.repo == nil || event == nil || parsed == nil {
		return true, nil
	}

	value := ""
	if parsed.Value != nil {
		value = parsed.Value.String()
	}

	payload := map[string]interface{}{
		"app_id":      parsed.AppID,
		"metric_name": parsed.MetricName,
		"value":       value,
	}

	processed := &neorequestsupabase.ProcessedEvent{
		ChainID:         s.chainID,
		TxHash:          event.TxHash,
		LogIndex:        event.LogIndex,
		BlockHeight:     event.BlockIndex,
		BlockHash:       event.BlockHash,
		ContractAddress: event.Contract,
		EventName:       event.EventName,
		Payload:         neorequestsupabase.MarshalParams(payload),
	}

	return s.repo.MarkProcessedEvent(ctx, processed)
}

// teeScriptInfo represents a TEE script definition in the manifest.
type teeScriptInfo struct {
	File        string `json:"file"`
	EntryPoint  string `json:"entry_point"`
	Description string `json:"description,omitempty"`
}

// loadTeeScript loads a TEE script from the app manifest by script name.
func (s *Service) loadTeeScript(appID, scriptName string) (scriptContent, entryPoint string, err error) {
	if s.scriptsURL == "" {
		return "", "", fmt.Errorf("scripts base URL not configured")
	}
	if appID == "" {
		return "", "", fmt.Errorf("app_id required")
	}
	if scriptName == "" {
		return "", "", fmt.Errorf("script_name required")
	}

	// Fetch manifest
	baseURL := strings.TrimSuffix(s.scriptsURL, "/")
	manifestURL := fmt.Sprintf("%s/apps/%s/manifest.json", baseURL, appID)
	manifestResp, manifestErr := s.httpClient.Get(manifestURL)
	if manifestErr != nil {
		return "", "", fmt.Errorf("failed to fetch manifest: %w", manifestErr)
	}
	defer manifestResp.Body.Close()

	if manifestResp.StatusCode != 200 {
		return "", "", fmt.Errorf("manifest not found: %s", manifestURL)
	}

	var manifest struct {
		TeeScripts map[string]teeScriptInfo `json:"tee_scripts"`
	}
	if decodeErr := json.NewDecoder(manifestResp.Body).Decode(&manifest); decodeErr != nil {
		return "", "", fmt.Errorf("invalid manifest: %w", decodeErr)
	}

	scriptInfo, ok := manifest.TeeScripts[scriptName]
	if !ok {
		return "", "", fmt.Errorf("script %q not found in manifest", scriptName)
	}
	if scriptInfo.File == "" {
		return "", "", fmt.Errorf("script %q has no file path", scriptName)
	}

	// Fetch script content
	scriptURL := fmt.Sprintf("%s/apps/%s/%s", baseURL, appID, scriptInfo.File)
	scriptResp, scriptErr := s.httpClient.Get(scriptURL)
	if scriptErr != nil {
		return "", "", fmt.Errorf("failed to fetch script: %w", scriptErr)
	}
	defer scriptResp.Body.Close()

	if scriptResp.StatusCode != 200 {
		return "", "", fmt.Errorf("script not found: %s", scriptURL)
	}

	// Read script content with size limit (1MB)
	const maxScriptSize = 1 << 20
	limitedReader := io.LimitReader(scriptResp.Body, maxScriptSize+1)
	scriptBytes, readErr := io.ReadAll(limitedReader)
	if readErr != nil {
		return "", "", fmt.Errorf("failed to read script: %w", readErr)
	}
	if len(scriptBytes) > maxScriptSize {
		return "", "", fmt.Errorf("script exceeds max size (%d bytes)", maxScriptSize)
	}

	entryPoint = scriptInfo.EntryPoint
	if entryPoint == "" {
		entryPoint = "main"
	}

	scriptContent = string(scriptBytes)
	return
}

func safeInt64(v uint64) int64 {
	if v > math.MaxInt64 {
		return math.MaxInt64
	}
	return int64(v)
}
