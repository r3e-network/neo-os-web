package neorequests

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
)

var onConflictConstraintMissingPattern = regexp.MustCompile(`(?i)no unique or exclusion constraint.*on conflict specification`)

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

	// Schema drift errors from Supabase/Postgres.
	if database.IsAPIErrorCode(err, "42703") || database.IsAPIErrorCode(err, "42P10") {
		return true
	}

	msg := strings.ToLower(err.Error())
	// Legacy fallback when callers return plain-text (non-typed) errors.
	return onConflictConstraintMissingPattern.MatchString(msg)
}
