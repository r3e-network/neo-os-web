// Package neofeeds provides HTTP handlers for the price feed aggregation service.
package neofeeds

import (
	"net/http"
	"sort"
	"strings"

	"github.com/gorilla/mux"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/httputil"
)

// =============================================================================
// HTTP Handlers
// =============================================================================

func (s *Service) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireAdminRole(w, r) {
		return
	}
	httputil.WriteJSON(w, http.StatusOK, s.config)
}

func (s *Service) handleListSources(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireAdminRole(w, r) {
		return
	}
	ids := make([]string, 0, len(s.sources))
	for id := range s.sources {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	sources := make([]SourceSummary, 0, len(ids))
	for _, id := range ids {
		src := s.sources[id]
		sources = append(sources, SourceSummary{
			ID:     id,
			Name:   src.Name,
			Weight: src.Weight,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, sources)
}

func (s *Service) handleGetPrice(w http.ResponseWriter, r *http.Request) {
	pair := mux.Vars(r)["pair"]
	if pair == "" {
		httputil.BadRequest(w, "pair required")
		return
	}

	price, err := s.GetPrice(r.Context(), pair)
	if err != nil {
		// Distinguish error types for appropriate HTTP status codes
		errMsg := err.Error()
		switch {
		case strings.Contains(errMsg, "pair required"):
			httputil.BadRequest(w, "pair required")
		case strings.Contains(errMsg, "not found"), strings.Contains(errMsg, "unsupported"), strings.Contains(errMsg, "unknown feed"):
			httputil.NotFound(w, "price feed not found")
		case strings.Contains(errMsg, "no sources"), strings.Contains(errMsg, "no prices"):
			httputil.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "price data unavailable"})
		default:
			s.Logger().Error(r.Context(), "failed to get price", err, nil)
			httputil.WriteErrorResponse(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error", nil)
		}
		return
	}

	httputil.WriteJSON(w, http.StatusOK, price)
}


func (s *Service) handleGetPrices(w http.ResponseWriter, r *http.Request) {
	if s.DB() == nil {
		httputil.WriteJSON(w, http.StatusOK, []PriceResponse{})
		return
	}

	// Use configured feeds, not hardcoded DefaultFeeds
	enabledFeeds := s.GetEnabledFeeds()
	var responses []PriceResponse
	for i := range enabledFeeds {
		feed := &enabledFeeds[i]
		if latest, err := s.DB().GetLatestPrice(r.Context(), feed.ID); err == nil {
			responses = append(responses, PriceResponse{
				FeedID:    latest.FeedID,
				Pair:      latest.Pair,
				Price:     latest.Price,
				Decimals:  latest.Decimals,
				Timestamp: latest.Timestamp,
				Sources:   latest.Sources,
				Signature: latest.Signature,
			})
		}
	}
	httputil.WriteJSON(w, http.StatusOK, responses)
}

func (s *Service) handleListFeeds(w http.ResponseWriter, r *http.Request) {
	// Return configured feeds, not sources
	enabledFeeds := s.GetEnabledFeeds()
	feeds := make([]FeedSummary, 0, len(enabledFeeds))
	for i := range enabledFeeds {
		feed := &enabledFeeds[i]
		sourcePair := feed.Pair
		if normalizePair(sourcePair) == normalizePair(feed.ID) {
			sourcePair = ""
		}
		feeds = append(feeds, FeedSummary{
			ID:         feed.ID,
			Pair:       feed.ID,
			SourcePair: sourcePair,
			Enabled:    feed.Enabled,
			Decimals:   feed.Decimals,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, feeds)
}
