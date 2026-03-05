package neorequests

import (
	"context"
	"strings"
	"time"
)

func (s *Service) rollupMiniAppStats(ctx context.Context) error {
	if s == nil || s.repo == nil {
		return nil
	}
	if s.statsRollupDisabled {
		return nil
	}

	err := s.repo.RollupMiniAppStats(ctx, time.Now().UTC())
	if err == nil {
		return nil
	}
	if isNonFatalStatsRollupError(err) {
		s.statsRollupDisabled = true
		if s.Logger() != nil {
			s.Logger().WithContext(ctx).WithError(err).Warn("miniapp stats rollup disabled due to incompatible database schema")
		}
		return nil
	}
	return err
}

func isNonFatalStatsRollupError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	if !strings.Contains(msg, "rollup miniapp stats") {
		return false
	}
	if strings.Contains(msg, "\"code\":\"42703\"") {
		return true // undefined column (schema drift)
	}
	if strings.Contains(msg, "\"code\":\"42p10\"") {
		return true // missing ON CONFLICT unique/exclusion constraint
	}
	if strings.Contains(msg, "on conflict specification") {
		return true
	}
	return false
}
