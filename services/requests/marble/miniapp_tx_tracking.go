package neorequests

import (
	"context"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/crypto"
	"github.com/R3E-Network/service_layer/infrastructure/database"
)

func (s *Service) trackMiniAppTx(ctx context.Context, appID, sender string, event *chain.ContractEvent) {
	if s == nil || !s.onchainTxUsage || s.repo == nil || event == nil {
		return
	}
	if strings.TrimSpace(sender) == "" {
		sender = event.Sender
	}
	s.logMiniAppTx(ctx, appID, sender, event.TxHash, event.Timestamp)
}

func (s *Service) handleMiniAppTxEvent(ctx context.Context, event *chain.TransactionEvent) error {
	if s == nil || !s.onchainTxUsage || s.repo == nil || event == nil {
		return nil
	}
	if len(event.Contracts) == 0 {
		return nil
	}

	sender := normalizeSenderAddress(event.Sender)
	for _, contractHash := range event.Contracts {
		normalized := normalizeContractHash(contractHash)
		if normalized == "" {
			continue
		}

		app, err := s.repo.GetMiniAppByContractHash(ctx, normalized)
		if err != nil {
			if database.IsNotFound(err) {
				continue
			}
			s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
				"contract_hash": contractHash,
				"tx_hash":       event.TxHash,
			}).Warn("failed to resolve miniapp contract hash")
			continue
		}
		if !isAppActive(app.Status) {
			continue
		}
		if s.enforceAppRegistry {
			if err := s.validateAppRegistry(ctx, app); err != nil {
				s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
					"app_id":  app.AppID,
					"tx_hash": event.TxHash,
				}).Warn("app registry validation failed for tx event")
				continue
			}
		}
		if contractHash := appContractHash(app); contractHash != "" {
			if contractHash != normalized {
				s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
					"app_id":        app.AppID,
					"tx_hash":       event.TxHash,
					"contract_hash": normalized,
				}).Warn("miniapp contract hash mismatch for tx event")
				continue
			}
		} else if s.requireManifestContract {
			s.Logger().WithContext(ctx).WithFields(map[string]interface{}{
				"app_id":        app.AppID,
				"tx_hash":       event.TxHash,
				"contract_hash": normalized,
			}).Warn("contract_hash missing; tx event rejected")
			continue
		}

		s.logMiniAppTx(ctx, app.AppID, sender, event.TxHash, event.Timestamp)
	}

	return nil
}

func (s *Service) logMiniAppTx(ctx context.Context, appID, sender, txHash string, timestamp time.Time) {
	if s == nil || !s.onchainTxUsage || s.repo == nil {
		return
	}

	appID = strings.TrimSpace(appID)
	if appID == "" || strings.TrimSpace(txHash) == "" {
		return
	}

	address := normalizeSenderAddress(sender)
	if err := s.repo.LogMiniAppTx(ctx, appID, txHash, address, timestamp); err != nil {
		s.Logger().WithContext(ctx).WithError(err).WithFields(map[string]interface{}{
			"app_id":  appID,
			"tx_hash": txHash,
		}).Warn("failed to log miniapp tx")
	}
}

func normalizeSenderAddress(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "N") && len(value) >= 34 {
		return value
	}
	hash, err := chain.ParseScriptHash(value)
	if err != nil {
		return value
	}
	return crypto.ScriptHashToAddress(hash.BytesLE())
}
