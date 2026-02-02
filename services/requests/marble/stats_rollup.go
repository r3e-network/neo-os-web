package neorequests

import (
	"context"
	"time"

	commonservice "github.com/R3E-Network/neo-miniapps-platform/infrastructure/service"
)

func (s *Service) registerStatsRollup() {
	if s == nil || s.BaseService == nil || s.statsRollupInterval <= 0 {
		return
	}

	s.BaseService.AddTickerWorker(
		s.statsRollupInterval,
		func(ctx context.Context) error {
			s.runStatsRollup(ctx)
			return nil
		},
		commonservice.WithTickerWorkerName("stats-rollup"),
	)
}

func (s *Service) runStatsRollup(ctx context.Context) {
	if s.repo == nil {
		return
	}

	logger := s.Logger().WithContext(ctx)

	// Roll up daily stats from contract events
	if err := s.repo.RollupMiniAppStats(ctx, time.Time{}); err != nil {
		logger.WithError(err).Warn("failed to rollup miniapp stats")
	}
}
