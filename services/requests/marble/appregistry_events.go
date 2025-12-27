package neorequests

import (
	"context"
	"encoding/hex"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	neorequestsupabase "github.com/R3E-Network/service_layer/services/requests/supabase"
)

func (s *Service) handleAppRegistryEvent(ctx context.Context, event *chain.ContractEvent) error {
	if event == nil {
		return nil
	}
	if s.appRegistry == nil || s.appRegistryHash == "" {
		return nil
	}
	if normalizeContractHash(event.Contract) != s.appRegistryHash {
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

	_ = s.storeContractEvent(ctx, event, &appID, neorequestsupabase.MarshalParams(map[string]interface{}{
		"app_id": appID,
	}))

	if _, err := s.loadMiniApp(ctx, appID); err != nil {
		if database.IsNotFound(err) {
			return nil
		}
		logger.WithContext(ctx).WithError(err).Warn("failed to load miniapp manifest")
		return nil
	}

	info, err := s.appRegistry.GetApp(ctx, appID)
	if err != nil {
		logger.WithContext(ctx).WithError(err).Warn("failed to read AppRegistry entry")
		return nil
	}
	if info == nil || strings.TrimSpace(info.AppID) == "" {
		return nil
	}

	update := &neorequestsupabase.MiniAppRegistryUpdate{
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
	if len(info.ContractHash) > 0 {
		update.ContractHash = hex.EncodeToString(info.ContractHash)
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
