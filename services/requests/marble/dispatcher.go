package neorequests

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/chain"
	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
	txproxytypes "github.com/r3e-network/neo-miniapp-platform/infrastructure/txproxy/types"
	neorequestsupabase "github.com/r3e-network/neo-miniapp-platform/services/requests/supabase"
)

const (
	maxTEEManifestBytes = 1 << 20
	maxTEEScriptBytes   = 1 << 20
)

func (s *Service) handleServiceRequested(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}
	if s.serviceGatewayHash != "" && normalizeContractHash(event.Contract) != s.serviceGatewayHash {
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
		processed, markErr := s.markEventProcessed(ctx, event, parsed)
		if markErr != nil {
			logger.WithError(markErr).Warn("failed to mark event processed")
		}
		if !processed {
			return nil
		}
	}

	s.storeRequestIndex(requestID, appID)
	if storeErr := s.storeContractEvent(ctx, event, &appID, buildServiceRequestedState(parsed)); storeErr != nil {
		logger.WithError(storeErr).Warn("failed to store service requested contract event")
	}

	app, err := s.loadMiniApp(ctx, appID)
	if err != nil {
		logger.WithError(err).Warn("miniapp not found")
		return nil
	}
	if !isAppActive(app.Status) {
		logger.WithError(nil).Warn("miniapp disabled")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, nil, "miniapp is not active")
		return nil
	}

	if validateErr := s.validateAppRegistry(ctx, app); validateErr != nil {
		logger.WithError(validateErr).Warn("app registry validation failed")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, nil, sanitizeError(validateErr.Error(), s.maxErrorLen))
		return nil
	}

	s.trackMiniAppTx(ctx, appID, "", event)

	manifestInfo, err := parseManifestInfo(app.Manifest)
	if err != nil {
		logger.WithError(err).Warn("invalid manifest")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, nil, "invalid miniapp manifest")
		return nil
	}

	if !permissionEnabled(manifestInfo.Permissions, serviceTypePermission(serviceType)) {
		logger.WithError(nil).Warn("permission denied")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, nil, "service permission not granted")
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
			s.updateServiceRequest(ctx, serviceReq, nil, "callback target mismatch")
			return nil
		}
	}

	serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)

	result, execErr := s.executeService(ctx, app.DeveloperUserID, appID, requestID, serviceType, parsed.Payload)
	if execErr == nil && len(result.ResultBytes) > s.maxResult {
		execErr = fmt.Errorf("result exceeds max size")
	}

	success := execErr == nil
	fulfillErr := s.fulfillRequest(ctx, parsed, result, execErr, serviceReq)
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
	if s.serviceGatewayHash != "" && normalizeContractHash(event.Contract) != s.serviceGatewayHash {
		return nil
	}

	parsed, err := chain.ParseServiceFulfilledEvent(event)
	if err != nil {
		return err
	}

	if s.repo != nil {
		processed, markErr := s.markGenericProcessed(ctx, event, map[string]interface{}{
			"request_id": parsed.RequestID,
		})
		if markErr != nil {
			s.Logger().WithContext(ctx).WithError(markErr).Warn("failed to mark service fulfilled event processed")
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
		s.Logger().WithContext(ctx).WithError(storeErr).Warn("failed to store service fulfilled contract event")
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

func (s *Service) fulfillRequest(ctx context.Context, req *chain.ServiceRequestedEvent, result serviceResult, execErr error, serviceReq *neorequestsupabase.ServiceRequest) error {
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
		ContractAddress: "0x" + s.serviceGatewayHash,
		MethodName:      "fulfillRequest",
		Params:          neorequestsupabase.MarshalParams(params),
		Status:          "pending",
	}

	if s.repo != nil {
		if createTxErr := s.repo.CreateChainTx(ctx, chainTx); createTxErr != nil {
			s.Logger().WithContext(ctx).WithError(createTxErr).Warn("failed to create chain_txs row")
		} else if serviceReq != nil {
			serviceReq.ChainTxID = &chainTx.ID
			if updateReqErr := s.repo.UpdateServiceRequest(ctx, serviceReq); updateReqErr != nil {
				s.Logger().WithContext(ctx).WithError(updateReqErr).Warn("failed to update service request with chain tx id")
			}
		}
	}

	resp, err := s.txProxy.Invoke(ctx, &txproxytypes.InvokeRequest{
		RequestID:    requestKey,
		ContractHash: "0x" + s.serviceGatewayHash,
		Method:       "fulfillRequest",
		Params:       params,
		Wait:         s.txWait,
	})
	if err != nil {
		chainTx.Status = "failed"
		chainTx.ErrorMessage = sanitizeError(err.Error(), s.maxErrorLen)
		if updateChainErr := s.updateChainTx(ctx, chainTx); updateChainErr != nil {
			s.Logger().WithContext(ctx).WithError(updateChainErr).Warn("failed to update failed chain tx")
		}
		s.updateServiceRequest(ctx, serviceReq, result.AuditJSON, err.Error())
		return err
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
	if updateChainErr := s.updateChainTx(ctx, chainTx); updateChainErr != nil {
		s.Logger().WithContext(ctx).WithError(updateChainErr).Warn("failed to persist chain tx update")
	}

	finalStatus := "completed"
	if !success || status == "failed" {
		finalStatus = "failed"
	}

	completedAt := time.Now().UTC()
	if serviceReq != nil {
		serviceReq.Status = finalStatus
		serviceReq.CompletedAt = &completedAt
		serviceReq.Result = result.AuditJSON
		if !success {
			serviceReq.Error = errorMsg
		}
		if updateReqErr := s.repo.UpdateServiceRequest(ctx, serviceReq); updateReqErr != nil {
			s.Logger().WithContext(ctx).WithError(updateReqErr).Warn("failed to finalize service request status")
		}
	}
	return nil
}

func (s *Service) updateChainTx(ctx context.Context, chainTx *neorequestsupabase.ChainTx) error {
	if s.repo == nil || chainTx == nil || chainTx.ID == 0 {
		return nil
	}
	return s.repo.UpdateChainTx(ctx, chainTx)
}

func (s *Service) updateServiceRequest(ctx context.Context, req *neorequestsupabase.ServiceRequest, result json.RawMessage, errMsg string) {
	if s.repo == nil || req == nil {
		return
	}
	req.Status = "failed"
	if len(result) > 0 {
		req.Result = result
	}
	if errMsg != "" {
		req.Error = sanitizeError(errMsg, s.maxErrorLen)
	}
	req.CompletedAt = ptrTime(time.Now().UTC())
	if updateErr := s.repo.UpdateServiceRequest(ctx, req); updateErr != nil {
		s.Logger().WithContext(ctx).WithError(updateErr).Warn("failed to update service request")
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
	if app, ok, notFound := s.getMiniAppCached(miniAppCacheKey("app:", appID)); ok {
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

	contractHash := appContractHash(app)
	s.cacheMiniApp(app, contractHash)
	return app, nil
}

func (s *Service) loadMiniAppByContractHash(ctx context.Context, contractHash string) (*neorequestsupabase.MiniApp, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("repository not configured")
	}
	normalized := normalizeContractHash(contractHash)
	if normalized == "" {
		return nil, fmt.Errorf("contract_hash cannot be empty")
	}
	if app, ok, notFound := s.getMiniAppCached(miniAppCacheKey("contract:", normalized)); ok {
		if notFound {
			return nil, miniAppNotFoundError(normalized)
		}
		return app, nil
	}

	app, err := s.repo.GetMiniAppByContractHash(ctx, normalized)
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
		TxHash:       event.TxHash,
		BlockIndex:   event.BlockIndex,
		ContractHash: event.Contract,
		EventName:    event.EventName,
		AppID:        appID,
		State:        state,
	}

	return s.repo.CreateContractEvent(ctx, record)
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
		processed, markErr := s.markNotificationProcessed(ctx, event, parsed)
		if markErr != nil {
			logger.WithContext(ctx).WithError(markErr).Warn("failed to mark notification event processed")
		}
		if !processed {
			return nil
		}
	}

	if s.repo != nil {
		var app *neorequestsupabase.MiniApp
		var appErr error
		if strings.TrimSpace(parsed.AppID) != "" {
			app, appErr = s.loadMiniApp(ctx, parsed.AppID)
		} else if strings.TrimSpace(event.Contract) != "" {
			app, appErr = s.loadMiniAppByContractHash(ctx, event.Contract)
			if appErr == nil && app != nil {
				parsed.AppID = app.AppID
				logger = s.Logger().WithFields(map[string]interface{}{
					"app_id": parsed.AppID,
					"title":  parsed.Title,
				})
			}
		}

		switch {
		case appErr != nil:
			if database.IsNotFound(appErr) {
				return nil
			}
			logger.WithContext(ctx).WithError(appErr).Warn("failed to load miniapp manifest")
		case app != nil:
			if !isAppActive(app.Status) {
				return nil
			}
			if s.enforceAppRegistry {
				if err := s.validateAppRegistry(ctx, app); err != nil {
					logger.WithContext(ctx).WithError(err).Warn("app registry validation failed")
					return nil
				}
			}
			info, parseErr := parseManifestInfo(app.Manifest)
			if parseErr == nil && info.NewsIntegration != nil && !*info.NewsIntegration {
				return nil
			}
			if contractHash := appContractHash(app); contractHash != "" {
				if normalizeContractHash(event.Contract) != contractHash {
					logger.WithContext(ctx).Warn("miniapp contract hash mismatch")
					return nil
				}
			} else if s.requireManifestContract {
				logger.WithContext(ctx).Warn("contract_hash missing; notification rejected")
				return nil
			}
		default:
			return nil
		}
	}

	s.trackMiniAppTx(ctx, parsed.AppID, "", event)
	if storeErr := s.storeContractEvent(ctx, event, &parsed.AppID, buildNotificationState(parsed)); storeErr != nil {
		logger.WithError(storeErr).Warn("failed to store notification contract event")
	}

	// Store notification in database via repository
	if s.repo != nil {
		blockNumber := int64(math.MaxInt64)
		if event.BlockIndex <= math.MaxInt64 {
			blockNumber = int64(event.BlockIndex)
		}
		createErr := s.repo.CreateNotification(ctx, &neorequestsupabase.Notification{
			AppID:            parsed.AppID,
			Title:            parsed.Title,
			Content:          parsed.Content,
			NotificationType: parsed.NotificationType,
			Source:           "contract",
			TxHash:           event.TxHash,
			BlockNumber:      blockNumber,
			Priority:         parsed.Priority,
		})
		if createErr != nil {
			logger.WithError(createErr).Error("failed to store notification")
			return createErr
		}
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
		processed, markErr := s.markMetricProcessed(ctx, event, parsed)
		if markErr != nil {
			logger.WithContext(ctx).WithError(markErr).Warn("failed to mark metric event processed")
		}
		if !processed {
			return nil
		}
	}

	if s.repo != nil {
		var app *neorequestsupabase.MiniApp
		var appErr error
		if strings.TrimSpace(parsed.AppID) != "" {
			app, appErr = s.loadMiniApp(ctx, parsed.AppID)
		} else if strings.TrimSpace(event.Contract) != "" {
			app, appErr = s.loadMiniAppByContractHash(ctx, event.Contract)
			if appErr == nil && app != nil {
				parsed.AppID = app.AppID
				logger = s.Logger().WithFields(map[string]interface{}{
					"app_id":      parsed.AppID,
					"metric_name": parsed.MetricName,
				})
			}
		}

		switch {
		case appErr != nil:
			if database.IsNotFound(appErr) {
				return nil
			}
			logger.WithContext(ctx).WithError(appErr).Warn("failed to load miniapp manifest")
		case app != nil:
			if !isAppActive(app.Status) {
				return nil
			}
			if s.enforceAppRegistry {
				if err := s.validateAppRegistry(ctx, app); err != nil {
					logger.WithContext(ctx).WithError(err).Warn("app registry validation failed")
					return nil
				}
			}
			if contractHash := appContractHash(app); contractHash != "" {
				if normalizeContractHash(event.Contract) != contractHash {
					logger.WithContext(ctx).Warn("miniapp contract hash mismatch")
					return nil
				}
			} else if s.requireManifestContract {
				logger.WithContext(ctx).Warn("contract_hash missing; metric rejected")
				return nil
			}
		default:
			return nil
		}
		s.trackMiniAppTx(ctx, parsed.AppID, "", event)
		if storeErr := s.storeContractEvent(ctx, event, &parsed.AppID, buildMetricState(parsed)); storeErr != nil {
			logger.WithError(storeErr).Warn("failed to store metric contract event")
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

type teeManifest struct {
	TeeScripts map[string]teeScriptInfo `json:"tee_scripts"`
}

// loadTeeScript loads a TEE script from the app manifest by script name.
func (s *Service) loadTeeScript(ctx context.Context, appID, scriptName string) (script, entryPoint string, err error) {
	if ctx == nil {
		ctx = context.Background()
	}
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
	manifestURL := teeAssetURL(baseURL, appID, "manifest.json")
	manifestBody, err := s.fetchTeeAsset(ctx, manifestURL, maxTEEManifestBytes, "manifest")
	if err != nil {
		return "", "", err
	}

	var manifest teeManifest
	if decodeErr := json.Unmarshal(manifestBody, &manifest); decodeErr != nil {
		return "", "", fmt.Errorf("invalid manifest: %w", decodeErr)
	}

	scriptInfo, ok := manifest.TeeScripts[scriptName]
	if !ok {
		return "", "", fmt.Errorf("script %q not found in manifest", scriptName)
	}
	if scriptInfo.File == "" {
		return "", "", fmt.Errorf("script %q has no file path", scriptName)
	}

	cleanFile, pathErr := sanitizeTEEScriptPath(scriptInfo.File)
	if pathErr != nil {
		return "", "", fmt.Errorf("script %q has invalid file path", scriptName)
	}

	// Fetch script content
	scriptURL := teeAssetURL(baseURL, appID, cleanFile)
	scriptBytes, err := s.fetchTeeAsset(ctx, scriptURL, maxTEEScriptBytes, "script")
	if err != nil {
		return "", "", err
	}

	entryPoint = scriptInfo.EntryPoint
	if entryPoint == "" {
		entryPoint = "main"
	}

	return string(scriptBytes), entryPoint, nil
}

func teeAssetURL(baseURL, appID, relPath string) string {
	return fmt.Sprintf("%s/apps/%s/%s", baseURL, url.PathEscape(appID), strings.TrimPrefix(relPath, "/"))
}

func (s *Service) fetchTeeAsset(ctx context.Context, assetURL string, maxSize int64, assetType string) ([]byte, error) {
	if s == nil || s.httpClient == nil {
		return nil, fmt.Errorf("http client not configured")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, assetURL, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create %s request: %w", assetType, err)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch %s: %w", assetType, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s not found: %s", assetType, assetURL)
	}

	limitedReader := io.LimitReader(resp.Body, maxSize+1)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read %s: %w", assetType, err)
	}
	if int64(len(body)) > maxSize {
		return nil, fmt.Errorf("%s exceeds max size (%d bytes)", assetType, maxSize)
	}

	return body, nil
}

func sanitizeTEEScriptPath(raw string) (string, error) {
	candidate := strings.TrimSpace(strings.ReplaceAll(raw, "\\", "/"))
	switch {
	case candidate == "":
		return "", fmt.Errorf("path is empty")
	case strings.ContainsRune(candidate, 0):
		return "", fmt.Errorf("path contains null byte")
	case strings.Contains(candidate, "%"):
		return "", fmt.Errorf("path contains percent-encoding")
	}

	cleaned := path.Clean(candidate)
	switch {
	case cleaned == "." || cleaned == "..":
		return "", fmt.Errorf("path resolves outside app directory")
	case strings.HasPrefix(cleaned, "/"):
		return "", fmt.Errorf("absolute paths are not allowed")
	case strings.HasPrefix(cleaned, "../"):
		return "", fmt.Errorf("path resolves outside app directory")
	}

	return cleaned, nil
}
