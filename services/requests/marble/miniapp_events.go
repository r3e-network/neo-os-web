package neorequests

import (
	"context"
	"strings"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	neorequestsupabase "github.com/R3E-Network/service_layer/services/requests/supabase"
)

var skipMiniAppEventNames = map[string]struct{}{
	"ServiceRequested":      {},
	"ServiceFulfilled":      {},
	"PaymentReceived":       {},
	"AppRegistered":         {},
	"AppUpdated":            {},
	"StatusChanged":         {},
	"Platform_Notification": {},
	"Notification":          {},
	"Platform_Metric":       {},
	"Metric":                {},
}

func (s *Service) handleMiniAppContractEvent(ctx context.Context, event *chain.ContractEvent) error {
	if s == nil || s.repo == nil || event == nil {
		return nil
	}
	if strings.TrimSpace(event.EventName) == "" {
		return nil
	}
	if _, skip := skipMiniAppEventNames[event.EventName]; skip {
		return nil
	}

	app, err := s.loadMiniAppByContractHash(ctx, event.Contract)
	if err != nil {
		if database.IsNotFound(err) {
			return nil
		}
		s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
			"contract_hash": event.Contract,
			"event":         event.EventName,
			"tx_hash":       event.TxHash,
		}).Warn("failed to resolve miniapp contract for event")
		return nil
	}
	if app == nil || !isAppActive(app.Status) {
		return nil
	}
	if s.enforceAppRegistry {
		if err := s.validateAppRegistry(ctx, app); err != nil {
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"app_id":  app.AppID,
				"event":   event.EventName,
				"tx_hash": event.TxHash,
			}).Warn("app registry validation failed for miniapp event")
			return nil
		}
	}
	if contractHash := appContractHash(app); contractHash != "" {
		if normalizeContractHash(event.Contract) != contractHash {
			s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
				"app_id":        app.AppID,
				"event":         event.EventName,
				"contract_hash": event.Contract,
				"tx_hash":       event.TxHash,
			}).Warn("miniapp contract hash mismatch for event")
			return nil
		}
	} else if s.requireManifestContract {
		s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
			"app_id":        app.AppID,
			"event":         event.EventName,
			"contract_hash": event.Contract,
			"tx_hash":       event.TxHash,
		}).Warn("contract_hash missing; event rejected")
		return nil
	}

	appID := app.AppID
	s.trackMiniAppTx(ctx, appID, "", event)
	if err := s.storeContractEvent(ctx, event, &appID, neorequestsupabase.MarshalParams(event.State)); err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
			"app_id":  appID,
			"event":   event.EventName,
			"tx_hash": event.TxHash,
		}).Warn("failed to store miniapp contract event")
	}
	return nil
}
