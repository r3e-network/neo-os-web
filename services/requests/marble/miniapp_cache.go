package neorequests

import (
	"strings"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/database"
	neorequestsupabase "github.com/R3E-Network/service_layer/services/requests/supabase"
)

type miniAppCacheEntry struct {
	app       *neorequestsupabase.MiniApp
	notFound  bool
	checkedAt time.Time
}

func (s *Service) getMiniAppCached(key string) (*neorequestsupabase.MiniApp, bool, bool) {
	if s == nil || s.miniAppCacheTTL <= 0 || key == "" {
		return nil, false, false
	}

	s.miniAppCacheMu.RLock()
	entry, ok := s.miniAppCache[key]
	s.miniAppCacheMu.RUnlock()
	if !ok {
		return nil, false, false
	}
	if time.Since(entry.checkedAt) > s.miniAppCacheTTL {
		s.deleteMiniAppCache(key)
		return nil, false, false
	}
	return entry.app, true, entry.notFound
}

func (s *Service) setMiniAppCache(key string, app *neorequestsupabase.MiniApp, notFound bool) {
	if s == nil || s.miniAppCacheTTL <= 0 || key == "" {
		return
	}
	s.miniAppCacheMu.Lock()
	s.miniAppCache[key] = miniAppCacheEntry{
		app:       app,
		notFound:  notFound,
		checkedAt: time.Now().UTC(),
	}
	s.miniAppCacheMu.Unlock()
}

func (s *Service) deleteMiniAppCache(key string) {
	if s == nil || key == "" {
		return
	}
	s.miniAppCacheMu.Lock()
	delete(s.miniAppCache, key)
	s.miniAppCacheMu.Unlock()
}

func miniAppCacheKey(prefix, chainID, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	chainID = strings.TrimSpace(chainID)
	if chainID == "" {
		return prefix + value
	}
	return prefix + chainID + ":" + value
}

func (s *Service) cacheMiniApp(app *neorequestsupabase.MiniApp, contractAddress string) {
	if s == nil || app == nil {
		return
	}
	if appID := strings.TrimSpace(app.AppID); appID != "" {
		s.setMiniAppCache(miniAppCacheKey("app:", "", appID), app, false)
	}
	if contractAddress != "" {
		s.setMiniAppCache(miniAppCacheKey("contract:", s.chainID, contractAddress), app, false)
	}
}

func (s *Service) cacheMiniAppNotFound(appID, contractAddress string) {
	if s == nil {
		return
	}
	if appID = strings.TrimSpace(appID); appID != "" {
		s.setMiniAppCache(miniAppCacheKey("app:", "", appID), nil, true)
	}
	if contractAddress = strings.TrimSpace(contractAddress); contractAddress != "" {
		s.setMiniAppCache(miniAppCacheKey("contract:", s.chainID, contractAddress), nil, true)
	}
}

func miniAppNotFoundError(key string) error {
	key = strings.TrimSpace(key)
	if key == "" {
		key = "unknown"
	}
	return database.NewNotFoundError("miniapps", key)
}
