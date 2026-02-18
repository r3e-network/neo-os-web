package database

import (
	"context"
	"encoding/json"
	"fmt"
)

// =============================================================================
// Replay Protection Operations
// =============================================================================

// MarkRequestSeen calls the mark_request_seen RPC function.
// Returns true if the request is new, false if it is a replay.
func (r *Repository) MarkRequestSeen(ctx context.Context, serviceID, requestID string, windowSeconds int) (bool, error) {
	if serviceID == "" {
		return false, fmt.Errorf("%w: service_id cannot be empty", ErrInvalidInput)
	}
	if requestID == "" {
		return false, fmt.Errorf("%w: request_id cannot be empty", ErrInvalidInput)
	}
	if windowSeconds <= 0 {
		windowSeconds = 600
	}

	body := map[string]interface{}{
		"p_service_id":     serviceID,
		"p_request_id":     requestID,
		"p_window_seconds": windowSeconds,
	}

	data, err := r.client.requestRPC(ctx, "POST", "rpc/mark_request_seen", body, "")
	if err != nil {
		return false, fmt.Errorf("%w: mark_request_seen: %v", ErrDatabaseError, err)
	}

	var result bool
	if err := json.Unmarshal(data, &result); err != nil {
		return false, fmt.Errorf("%w: unmarshal mark_request_seen: %v", ErrDatabaseError, err)
	}
	return result, nil
}

// CleanupSeenRequests calls the cleanup_seen_requests RPC function.
// Pass empty serviceID to clean all services.
func (r *Repository) CleanupSeenRequests(ctx context.Context, serviceID string) (int, error) {
	var body interface{}
	if serviceID != "" {
		body = map[string]interface{}{
			"p_service_id": serviceID,
		}
	} else {
		body = map[string]interface{}{}
	}

	data, err := r.client.requestRPC(ctx, "POST", "rpc/cleanup_seen_requests", body, "")
	if err != nil {
		return 0, fmt.Errorf("%w: cleanup_seen_requests: %v", ErrDatabaseError, err)
	}

	var count int
	if err := json.Unmarshal(data, &count); err != nil {
		return 0, fmt.Errorf("%w: unmarshal cleanup_seen_requests: %v", ErrDatabaseError, err)
	}
	return count, nil
}
