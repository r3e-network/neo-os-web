package neorequests

import (
	"context"
	"encoding/json"
	"math/big"
	"strings"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	neorequestsupabase "github.com/R3E-Network/service_layer/services/requests/supabase"
)

func (s *Service) handlePaymentReceivedEvent(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}
	if s.paymentHubHash != "" && normalizeContractHash(event.Contract) != s.paymentHubHash {
		return nil
	}

	parsed, err := chain.ParsePaymentReceivedEvent(event)
	if err != nil {
		return nil
	}

	logger := s.Logger().WithFields(map[string]interface{}{
		"app_id": parsed.AppID,
		"sender": parsed.SenderAddress,
		"amount": parsed.Amount,
	})

	if s.repo != nil {
		processed, err := s.markPaymentProcessed(ctx, event, parsed)
		if err != nil {
			logger.WithContext(ctx).WithError(err).Warn("failed to mark payment event processed")
		}
		if !processed {
			return nil
		}
	}

	if s.repo != nil {
		app, err := s.loadMiniApp(ctx, parsed.AppID)
		if err != nil {
			if database.IsNotFound(err) {
				return nil
			}
			logger.WithContext(ctx).WithError(err).Warn("failed to load miniapp manifest")
		} else if app != nil {
			if !isAppActive(app.Status) {
				return nil
			}
			if s.enforceAppRegistry {
				if err := s.validateAppRegistry(ctx, app); err != nil {
					logger.WithContext(ctx).WithError(err).Warn("app registry validation failed")
					return nil
				}
			}
		} else {
			return nil
		}
	}

	_ = s.storeContractEvent(ctx, event, &parsed.AppID, buildPaymentReceivedState(parsed))

	s.trackMiniAppTx(ctx, parsed.AppID, parsed.SenderAddress, event)

	if !s.onchainUsage {
		return nil
	}

	if s.repo == nil || s.DB() == nil {
		return nil
	}

	user, err := s.DB().GetUserByAddress(ctx, parsed.SenderAddress)
	if err != nil {
		if database.IsNotFound(err) {
			return nil
		}
		logger.WithContext(ctx).WithError(err).Warn("failed to resolve user by address")
		return nil
	}
	if user == nil || strings.TrimSpace(user.ID) == "" {
		return nil
	}

	var amount *big.Int
	if parsed.Amount != "" {
		amount = new(big.Int)
		if _, ok := amount.SetString(parsed.Amount, 10); !ok {
			amount = nil
		}
	}

	if err := s.repo.BumpMiniAppUsage(ctx, user.ID, parsed.AppID, amount, nil); err != nil {
		logger.WithContext(ctx).WithError(err).Warn("failed to bump miniapp usage")
	}

	return nil
}

func buildPaymentReceivedState(event *chain.PaymentReceivedEvent) json.RawMessage {
	if event == nil {
		return nil
	}
	state := map[string]interface{}{
		"payment_id": event.PaymentID,
		"app_id":     event.AppID,
		"sender":     event.SenderAddress,
		"amount":     event.Amount,
		"memo":       event.Memo,
	}
	return neorequestsupabase.MarshalParams(state)
}

func (s *Service) markPaymentProcessed(
	ctx context.Context,
	event *chain.ContractEvent,
	parsed *chain.PaymentReceivedEvent,
) (bool, error) {
	if s.repo == nil || event == nil || parsed == nil {
		return true, nil
	}

	payload := map[string]interface{}{
		"payment_id": parsed.PaymentID,
		"app_id":     parsed.AppID,
		"sender":     parsed.SenderAddress,
		"amount":     parsed.Amount,
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
