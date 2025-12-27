package neorequests

import (
	"context"
	"time"
)

func (s *Service) rollupMiniAppStats(ctx context.Context) error {
	if s == nil || s.repo == nil {
		return nil
	}
	return s.repo.RollupMiniAppStats(ctx, time.Now().UTC())
}
