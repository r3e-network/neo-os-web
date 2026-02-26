package neorequests

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
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
	logger.Info("service request received")

	if claimed, existingAppID := s.claimRequestIndex(requestID, appID); !claimed {
		logger.WithFields(map[string]interface{}{
			"inflight_app_id": existingAppID,
		}).Info("duplicate service request already in-flight locally")
		return nil
	}

	if s.repo != nil {
		markStarted := time.Now()
		markCtx, cancelMark := s.withPreValidationTimeout(ctx)
		processed, markErr := s.markEventProcessed(markCtx, event, parsed)
		cancelMark()
		markDuration := time.Since(markStarted)
		logger.WithFields(map[string]interface{}{
			"step":        "mark_event_processed",
			"duration_ms": markDuration.Milliseconds(),
			"processed":   processed,
		}).Info("service request pre-validation step completed")
		if markErr != nil {
			logger.WithFields(map[string]interface{}{
				"step":        "mark_event_processed",
				"duration_ms": markDuration.Milliseconds(),
			}).WithError(markErr).Warn("service request pre-validation step failed")
		}
		if !processed {
			pending, pendingErr := s.isGatewayRequestPending(ctx, requestID)
			if pendingErr != nil {
				logger.WithFields(map[string]interface{}{
					"step": "check_gateway_request_status",
				}).WithError(pendingErr).Warn("failed to verify duplicate service request state; skipping event")
				return nil
			}
			if !pending {
				logger.WithFields(map[string]interface{}{
					"step": "check_gateway_request_status",
				}).Info("service request already resolved on-chain; skipping duplicate event")
				return nil
			}

			logger.WithFields(map[string]interface{}{
				"step": "check_gateway_request_status",
			}).Info("service request still pending on-chain after processed_events dedupe; continuing recovery processing")
		}
	}

	storeStarted := time.Now()
	storeCtx, cancelStore := s.withPreValidationTimeout(ctx)
	storeErr := s.storeContractEvent(storeCtx, event, &appID, buildServiceRequestedState(parsed))
	cancelStore()
	storeDuration := time.Since(storeStarted)
	logger.WithFields(map[string]interface{}{
		"step":        "store_contract_event",
		"duration_ms": storeDuration.Milliseconds(),
	}).Info("service request pre-validation step completed")
	if storeErr != nil {
		logger.WithError(storeErr).Warn("failed to store service requested contract event")
	}

	loadStarted := time.Now()
	loadCtx, cancelLoad := s.withPreValidationTimeout(ctx)
	app, err := s.loadMiniApp(loadCtx, appID)
	cancelLoad()
	loadDuration := time.Since(loadStarted)
	logger.WithFields(map[string]interface{}{
		"step":        "load_miniapp",
		"duration_ms": loadDuration.Milliseconds(),
	}).Info("service request pre-validation step completed")
	if err != nil {
		logger.WithError(err).Warn("miniapp not found")
		return nil
	}
	if !isAppActive(app.Status) {
		logger.WithField("miniapp_status", app.Status).Warn("miniapp disabled")
		serviceReq := s.createServiceRequest(ctx, app, parsed, serviceType)
		s.updateServiceRequest(ctx, serviceReq, nil, "miniapp is not active")
		return nil
	}

	validateStarted := time.Now()
	validateCtx, cancelValidate := s.withPreValidationTimeout(ctx)
	validateErr := s.validateAppRegistry(validateCtx, app)
	cancelValidate()
	validateDuration := time.Since(validateStarted)
	logger.WithFields(map[string]interface{}{
		"step":        "validate_app_registry",
		"duration_ms": validateDuration.Milliseconds(),
	}).Info("service request pre-validation step completed")
	if validateErr != nil {
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
		logger.WithField("permission", serviceTypePermission(serviceType)).Warn("permission denied")
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
	logger.Info("service request validated")

	execCtx := ctx
	cancelExec := func() {}
	if s.serviceTimeout > 0 {
		execCtx, cancelExec = context.WithTimeout(ctx, s.serviceTimeout)
	}
	defer cancelExec()

	result, execErr := s.executeService(execCtx, app.DeveloperUserID, appID, requestID, serviceType, parsed.Payload)
	if execErr == nil && len(result.ResultBytes) > s.maxResult {
		execErr = fmt.Errorf("result exceeds max size")
	}

	success := execErr == nil
	fulfillErr := s.fulfillRequest(ctx, parsed, result, execErr, serviceReq)
	if fulfillErr != nil {
		logger.WithError(fulfillErr).Warn("callback fulfillment failed")
	} else {
		logger.Info("service request fulfillment submitted")
	}

	if !success {
		logger.WithError(execErr).Warn("service execution failed")
	}

	return nil
}

func (s *Service) withPreValidationTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx == nil {
		ctx = context.Background()
	}
	if s == nil || s.preValidationTimeout <= 0 {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, s.preValidationTimeout)
}

func (s *Service) isGatewayRequestPending(ctx context.Context, requestID string) (bool, error) {
	if s == nil || s.chainClient == nil || s.serviceGatewayHash == "" {
		return false, fmt.Errorf("gateway status check unavailable")
	}

	reqNum, ok := new(big.Int).SetString(strings.TrimSpace(requestID), 10)
	if !ok || reqNum.Sign() <= 0 {
		return false, fmt.Errorf("invalid request_id")
	}

	checkCtx, cancel := s.withPreValidationTimeout(ctx)
	defer cancel()

	res, err := s.chainClient.InvokeFunction(
		checkCtx,
		"0x"+s.serviceGatewayHash,
		"getRequest",
		[]chain.ContractParam{chain.NewIntegerParam(reqNum)},
	)
	if err != nil {
		return false, err
	}
	if res == nil {
		return false, fmt.Errorf("empty getRequest result")
	}
	if !strings.EqualFold(strings.TrimSpace(res.State), "HALT") {
		if strings.TrimSpace(res.Exception) == "" {
			return false, fmt.Errorf("getRequest did not HALT")
		}
		return false, fmt.Errorf("getRequest fault: %s", strings.TrimSpace(res.Exception))
	}
	if len(res.Stack) == 0 {
		return false, fmt.Errorf("empty getRequest stack")
	}

	items, err := chain.ParseArray(res.Stack[0])
	if err != nil {
		return false, err
	}
	if len(items) < 8 {
		return false, fmt.Errorf("unexpected getRequest payload")
	}

	status, err := chain.ParseInteger(items[7])
	if err != nil {
		return false, err
	}
	return status.Sign() == 0, nil
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

	requestKey := buildTxProxyRequestID(ServiceID, s.serviceGatewayHash, req.AppID, req.RequestID)
	txProxyRequestID := requestKey
	chainTx := &neorequestsupabase.ChainTx{
		RequestID:       requestKey,
		FromService:     ServiceID,
		TxType:          "service_callback",
		ContractAddress: "0x" + s.serviceGatewayHash,
		MethodName:      "fulfillRequest",
		Params:          neorequestsupabase.MarshalParams(params),
		Status:          "pending",
		ChainID:         s.chainID,
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

	invoke := func(requestID string) (*txproxytypes.InvokeResponse, error) {
		return s.txProxy.Invoke(ctx, &txproxytypes.InvokeRequest{
			RequestID:    requestID,
			ContractHash: "0x" + s.serviceGatewayHash,
			Method:       "fulfillRequest",
			Params:       params,
			Wait:         s.txWait,
		})
	}

	resp, err := invoke(txProxyRequestID)
	if err != nil && isTxProxyRequestIDConflict(err) {
		pending, pendingErr := s.isGatewayRequestPending(ctx, req.RequestID)
		switch {
		case pendingErr != nil:
			s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
				"request_id":          req.RequestID,
				"txproxy_request_id":  requestKey,
				"gateway_contract":    "0x" + s.serviceGatewayHash,
				"pending_check_error": pendingErr.Error(),
			}).WithError(err).Warn("txproxy request_id conflict and gateway pending state check failed")
		case !pending:
			s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
				"request_id":         req.RequestID,
				"txproxy_request_id": requestKey,
			}).Info("gateway request already resolved; treating txproxy request_id conflict as idempotent")
			resp = &txproxytypes.InvokeResponse{RequestID: requestKey}
			err = nil
		default:
			txProxyRequestID = requestKey + ":retry:" + fmt.Sprintf("%d", time.Now().UTC().UnixNano())
			s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
				"request_id":               req.RequestID,
				"txproxy_request_id":       requestKey,
				"retry_txproxy_request_id": txProxyRequestID,
			}).Warn("txproxy request_id conflict on pending gateway request; retrying with alternate request_id")
			resp, err = invoke(txProxyRequestID)
		}
	}
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

	finalStatus := "fulfilled"
	if !success || status == "failed" {
		finalStatus = "failed"
	}

	fulfilledAt := time.Now().UTC()
	if serviceReq != nil {
		serviceReq.Status = finalStatus
		serviceReq.FulfilledAt = &fulfilledAt
		serviceReq.Success = ptrBool(success)
		serviceReq.Result = result.AuditJSON
		if !success {
			serviceReq.ErrorMessage = errorMsg
		}
		serviceReq.LastError = serviceReq.ErrorMessage
		serviceReq.ChainID = s.chainID
		if updateReqErr := s.repo.UpdateServiceRequest(ctx, serviceReq); updateReqErr != nil {
			s.Logger().WithContext(ctx).WithError(updateReqErr).Warn("failed to finalize service request status")
		}
	}
	return nil
}

func buildTxProxyRequestID(serviceID, gatewayHash, appID, requestID string) string {
	parts := []string{strings.TrimSpace(serviceID)}
	if normalizedGateway := normalizeContractHash(gatewayHash); normalizedGateway != "" {
		parts = append(parts, normalizedGateway)
	}
	if trimmedAppID := strings.TrimSpace(appID); trimmedAppID != "" {
		parts = append(parts, trimmedAppID)
	}
	parts = append(parts, strings.TrimSpace(requestID))
	return strings.Join(parts, ":")
}

func isTxProxyRequestIDConflict(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(strings.TrimSpace(err.Error()))
	if !strings.Contains(msg, "409 conflict") {
		return false
	}
	return strings.Contains(msg, "request_id already used") || strings.Contains(msg, "\"code\":\"conflict\"")
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
	req.Success = ptrBool(false)
	if len(result) > 0 {
		req.Result = result
	}
	if errMsg != "" {
		req.ErrorMessage = sanitizeError(errMsg, s.maxErrorLen)
		req.LastError = req.ErrorMessage
	}
	req.FulfilledAt = ptrTime(time.Now().UTC())
	req.ChainID = s.chainID
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
		RequestID:        parseRequestID(parsed.RequestID),
		AppID:            parsed.AppID,
		ServiceType:      serviceType,
		Requester:        parsed.Requester,
		CallbackContract: parsed.CallbackContract,
		CallbackMethod:   parsed.CallbackMethod,
		Status:           "pending",
		Payload:          neorequestsupabase.MarshalParams(payloadAudit),
		ChainID:          s.chainID,
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
