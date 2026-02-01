package neorequests

import (
	"context"
	"strings"
	"time"

	commonservice "github.com/R3E-Network/neo-miniapps-platform/infrastructure/service"
)

type requestIndexEntry struct {
	appID     string
	expiresAt time.Time
}

func (s *Service) storeRequestIndex(requestID, appID string) {
	if s == nil || s.requestIndexTTL <= 0 {
		return
	}
	requestID = strings.TrimSpace(requestID)
	appID = strings.TrimSpace(appID)
	if requestID == "" || appID == "" {
		return
	}
	s.requestIndex.Store(requestID, requestIndexEntry{
		appID:     appID,
		expiresAt: time.Now().Add(s.requestIndexTTL),
	})
}

func (s *Service) lookupRequestIndex(requestID string) string {
	if s == nil {
		return ""
	}
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return ""
	}

	raw, ok := s.requestIndex.Load(requestID)
	if !ok {
		return ""
	}
	entry, ok := raw.(requestIndexEntry)
	if !ok {
		s.requestIndex.Delete(requestID)
		return ""
	}
	if s.requestIndexTTL > 0 && !entry.expiresAt.IsZero() && time.Now().After(entry.expiresAt) {
		s.requestIndex.Delete(requestID)
		return ""
	}
	return entry.appID
}

func (s *Service) deleteRequestIndex(requestID string) {
	if s == nil {
		return
	}
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return
	}
	s.requestIndex.Delete(requestID)
}

func (s *Service) cleanupRequestIndex() {
	if s == nil || s.requestIndexTTL <= 0 {
		return
	}

	now := time.Now()
	s.requestIndex.Range(func(key, value interface{}) bool {
		entry, ok := value.(requestIndexEntry)
		if !ok {
			s.requestIndex.Delete(key)
			return true
		}
		if entry.expiresAt.IsZero() || now.After(entry.expiresAt) {
			s.requestIndex.Delete(key)
		}
		return true
	})
}

func (s *Service) registerRequestIndexCleanup() {
	if s == nil || s.BaseService == nil || s.requestIndexTTL <= 0 {
		return
	}

	interval := s.requestIndexTTL / 2
	if interval < time.Minute {
		interval = time.Minute
	}

	s.BaseService.AddTickerWorker(
		interval,
		func(ctx context.Context) error {
			s.cleanupRequestIndex()
			return nil
		},
		commonservice.WithTickerWorkerName("request-index-cleanup"),
	)
}
