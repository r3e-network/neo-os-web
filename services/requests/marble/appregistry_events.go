package neorequests

import (
	"context"
	"encoding/hex"
	"strings"
	"time"

	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/chain"
	"github.com/R3E-Network/neo-miniapps-platform/infrastructure/database"
	neorequestsupabase "github.com/R3E-Network/neo-miniapps-platform/services/requests/supabase"
)

func (s *Service) handleAppRegistryEvent(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}
	chainCtx := s.getChainContext(event.ChainID)
	if chainCtx == nil || chainCtx.AppRegistry == nil || chainCtx.AppRegistryAddress == "" {
		return nil
	}
	if normalizeContractAddress(event.Contract) != chainCtx.AppRegistryAddress {
		return nil
	}

	parsed, err := chain.ParseAppRegistryEvent(event)
	if err != nil {
		return nil
	}

	appID := strings.TrimSpace(parsed.AppID)
	if appID == "" {
		return nil
	}

	logger := s.Logger().WithFields(map[string]interface{}{
		"app_id": appID,
		"event":  event.EventName,
	})

	if s.repo == nil {
		return nil
	}

	processed, err := s.markGenericProcessed(ctx, event, map[string]interface{}{
		"app_id": appID,
	})
	if err != nil {
		logger.WithContext(ctx).WithError(err).Warn("failed to mark AppRegistry event processed")
	}
	if !processed {
		return nil
	}

	storeErr := s.storeContractEvent(ctx, event, &appID, neorequestsupabase.MarshalParams(map[string]interface{}{
		"app_id": appID,
	}))
	if storeErr != nil {
		logger.WithError(storeErr).Warn("failed to store contract event")
	}

	if _, loadErr := s.loadMiniApp(ctx, appID, event.ChainID); loadErr != nil {
		if database.IsNotFound(loadErr) {
			return nil
		}
		logger.WithContext(ctx).WithError(loadErr).Warn("failed to load miniapp manifest")
		return nil
	}

	info, err := chainCtx.AppRegistry.GetApp(ctx, appID)
	if err != nil {
		logger.WithContext(ctx).WithError(err).Warn("failed to read AppRegistry entry")
		return nil
	}
	if info == nil || strings.TrimSpace(info.AppID) == "" {
		return nil
	}

	update := &neorequestsupabase.MiniAppRegistryUpdate{
		ChainID:   event.ChainID,
		Status:    mapAppRegistryStatus(info.Status),
		UpdatedAt: time.Now().UTC(),
	}
	if entryURL := strings.TrimSpace(info.EntryURL); entryURL != "" {
		update.EntryURL = entryURL
	}
	if len(info.ManifestHash) > 0 {
		update.ManifestHash = hex.EncodeToString(info.ManifestHash)
	}
	if len(info.DeveloperPubKey) > 0 {
		update.DeveloperPubKey = hex.EncodeToString(info.DeveloperPubKey)
	}
	if name := strings.TrimSpace(info.Name); name != "" {
		update.Name = name
	}
	if description := strings.TrimSpace(info.Description); description != "" {
		update.Description = description
	}
	if icon := strings.TrimSpace(info.Icon); icon != "" {
		update.Icon = icon
	}
	if banner := strings.TrimSpace(info.Banner); banner != "" {
		update.Banner = banner
	}
	if category := strings.TrimSpace(info.Category); category != "" {
		update.Category = category
	}
	if len(info.ContractAddress) > 0 {
		update.ContractAddress = hex.EncodeToString(info.ContractAddress)
	}

	if err := s.repo.UpdateMiniAppRegistry(ctx, appID, update); err != nil {
		logger.WithContext(ctx).WithError(err).Warn("failed to sync AppRegistry state")
	}

	return nil
}

func mapAppRegistryStatus(status int) string {
	switch status {
	case chain.AppRegistryStatusApproved:
		return "active"
	case chain.AppRegistryStatusDisabled:
		return "disabled"
	case chain.AppRegistryStatusPending:
		return "pending"
	default:
		return "pending"
	}
}
