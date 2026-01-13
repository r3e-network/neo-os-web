package neorequests

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	neorequestsupabase "github.com/R3E-Network/service_layer/services/requests/supabase"
)

type appRegistryCacheEntry struct {
	info      *chain.AppRegistryApp
	checkedAt time.Time
}

func (s *Service) validateAppRegistry(ctx context.Context, app *neorequestsupabase.MiniApp) error {
	if s == nil || !s.enforceAppRegistry || s.appRegistry == nil {
		return nil
	}
	if app == nil || strings.TrimSpace(app.AppID) == "" {
		return fmt.Errorf("app registry check requires app_id")
	}

	info, err := s.getAppRegistryInfo(ctx, app.AppID)
	if err != nil {
		return err
	}
	if info == nil || strings.TrimSpace(info.AppID) == "" {
		return fmt.Errorf("app not registered in AppRegistry")
	}
	if info.Status != chain.AppRegistryStatusApproved {
		return fmt.Errorf("app not approved in AppRegistry (status=%d)", info.Status)
	}

	manifestHash := normalizeHexString(app.ManifestHash)
	if manifestHash == "" {
		return fmt.Errorf("miniapp manifest_hash missing")
	}
	manifestBytes, err := hex.DecodeString(manifestHash)
	if err != nil {
		return fmt.Errorf("miniapp manifest_hash invalid: %w", err)
	}
	if len(info.ManifestHash) == 0 || !bytes.Equal(manifestBytes, info.ManifestHash) {
		return fmt.Errorf("manifest hash mismatch")
	}

	entryURL := strings.TrimSpace(app.EntryURL)
	if entryURL != "" && info.EntryURL != "" && entryURL != info.EntryURL {
		return fmt.Errorf("entry_url mismatch")
	}

	if len(info.ContractAddress) > 0 {
		contractAddress := appContractAddress(app, s.chainID)
		if contractAddress != "" && hex.EncodeToString(info.ContractAddress) != contractAddress {
			return fmt.Errorf("contract address mismatch")
		}
	}

	return nil
}

func (s *Service) getAppRegistryInfo(ctx context.Context, appID string) (*chain.AppRegistryApp, error) {
	if s == nil || s.appRegistry == nil || !s.enforceAppRegistry {
		return nil, nil
	}

	appID = strings.TrimSpace(appID)
	if appID == "" {
		return nil, fmt.Errorf("app registry lookup requires app_id")
	}

	if s.appRegistryTTL > 0 {
		if info, ok := s.getAppRegistryCached(appID); ok {
			return info, nil
		}
	}

	info, err := s.appRegistry.GetApp(ctx, appID)
	if err != nil {
		return nil, err
	}

	if s.appRegistryTTL > 0 {
		s.setAppRegistryCached(appID, info)
	}
	return info, nil
}

func (s *Service) getAppRegistryCached(appID string) (*chain.AppRegistryApp, bool) {
	s.appRegistryMu.RLock()
	entry, ok := s.appRegistryCache[appID]
	s.appRegistryMu.RUnlock()
	if !ok {
		return nil, false
	}
	if s.appRegistryTTL <= 0 {
		return entry.info, true
	}
	if time.Since(entry.checkedAt) > s.appRegistryTTL {
		return nil, false
	}
	return entry.info, true
}

func (s *Service) setAppRegistryCached(appID string, info *chain.AppRegistryApp) {
	if s.appRegistryTTL <= 0 {
		return
	}
	s.appRegistryMu.Lock()
	s.appRegistryCache[appID] = appRegistryCacheEntry{
		info:      info,
		checkedAt: time.Now().UTC(),
	}
	s.appRegistryMu.Unlock()
}

func normalizeHexString(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "0x")
	value = strings.TrimPrefix(value, "0X")
	value = strings.ToLower(value)
	if value == "" {
		return ""
	}
	if len(value)%2 != 0 {
		return ""
	}
	for _, ch := range value {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') {
			return ""
		}
	}
	return value
}
