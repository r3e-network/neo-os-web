// Package framework provides the IntentRouter for Android-style intent routing.
// IntentRouter dispatches intents to registered receivers based on intent filters.
package framework

import (
	"context"
	"fmt"
	"sort"
	"sync"
)

// IntentRouter routes intents to registered receivers based on intent filters.
// It is inspired by Android's PackageManager intent resolution.
type IntentRouter struct {
	// Registered receivers with their filters
	receivers map[string]*receiverEntry

	// Component registry for explicit intents
	components map[string]IntentHandler

	// Permission manager for permission checks
	permissionManager *PermissionManager

	mu sync.RWMutex
}

// receiverEntry holds a receiver and its associated filters.
type receiverEntry struct {
	receiver BroadcastReceiver
	filters  []*IntentFilter
	pkg      string
}

// IntentHandler handles explicit intents for a component.
type IntentHandler interface {
	// HandleIntent processes an intent and returns a result.
	HandleIntent(ctx context.Context, intent *Intent) (*IntentResult, error)
}

// IntentResult represents the result of handling an intent.
type IntentResult struct {
	// ResultCode indicates success or failure.
	ResultCode int

	// Data contains result data.
	Data map[string]any

	// Error contains any error message.
	Error string
}

// Result codes
const (
	ResultOK       = 0
	ResultCanceled = 1
	ResultError    = -1
)

// NewIntentRouter creates a new IntentRouter.
func NewIntentRouter() *IntentRouter {
	return &IntentRouter{
		receivers:  make(map[string]*receiverEntry),
		components: make(map[string]IntentHandler),
	}
}

// NewIntentRouterWithPermissions creates a new IntentRouter with permission checking.
func NewIntentRouterWithPermissions(pm *PermissionManager) *IntentRouter {
	return &IntentRouter{
		receivers:         make(map[string]*receiverEntry),
		components:        make(map[string]IntentHandler),
		permissionManager: pm,
	}
}

// RegisterReceiver registers a broadcast receiver with intent filters.
func (r *IntentRouter) RegisterReceiver(id string, receiver BroadcastReceiver, pkg string, filters ...*IntentFilter) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.receivers[id] = &receiverEntry{
		receiver: receiver,
		filters:  filters,
		pkg:      pkg,
	}
}

// UnregisterReceiver removes a registered receiver.
func (r *IntentRouter) UnregisterReceiver(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.receivers, id)
}

// RegisterComponent registers a component for explicit intents.
func (r *IntentRouter) RegisterComponent(name string, handler IntentHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.components[name] = handler
}

// UnregisterComponent removes a registered component.
func (r *IntentRouter) UnregisterComponent(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.components, name)
}

// ResolveIntent finds all receivers that match an intent.
func (r *IntentRouter) ResolveIntent(intent *Intent) []*ResolveInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var results []*ResolveInfo

	// For explicit intents, check component registry
	if intent.IsExplicit() {
		if handler, ok := r.components[intent.Component]; ok {
			results = append(results, &ResolveInfo{
				Component: intent.Component,
				Handler:   handler,
				Priority:  1000, // Explicit intents have highest priority
				Match:     1000,
			})
		}
		return results
	}

	// For implicit intents, check all receivers
	for id, entry := range r.receivers {
		for _, filter := range entry.filters {
			if score := filter.Match(intent); score > 0 {
				results = append(results, &ResolveInfo{
					ReceiverID: id,
					Receiver:   entry.receiver,
					Filter:     filter,
					Package:    entry.pkg,
					Priority:   filter.Priority,
					Match:      score,
				})
			}
		}
	}

	// Sort by match score (highest first)
	sort.Slice(results, func(i, j int) bool {
		return results[i].Match > results[j].Match
	})

	return results
}

// ResolveInfo contains information about a resolved intent target.
type ResolveInfo struct {
	// For explicit intents
	Component string
	Handler   IntentHandler

	// For implicit intents
	ReceiverID string
	Receiver   BroadcastReceiver
	Filter     *IntentFilter
	Package    string

	// Match information
	Priority int
	Match    int
}

// RouteIntent routes an intent to the best matching receiver.
func (r *IntentRouter) RouteIntent(ctx context.Context, svcCtx ServiceContext, intent *Intent) error {
	resolved := r.ResolveIntent(intent)
	if len(resolved) == 0 {
		return &IntentError{
			Intent: intent,
			Err:    "no receiver found for intent",
		}
	}

	// Check permissions if permission manager is set
	if r.permissionManager != nil && intent.SourcePackage != "" {
		// Check if source package has permission to send this intent
		if intent.Action != "" {
			perm := actionToPermission(intent.Action)
			if perm != "" {
				result := r.permissionManager.CheckPermission(ctx, intent.SourcePackage, perm)
				if result != PermissionGranted {
					return &IntentError{
						Intent: intent,
						Err:    fmt.Sprintf("permission denied: %s", perm),
					}
				}
			}
		}
	}

	// Route to the best match
	best := resolved[0]

	// Handle explicit intent
	if best.Handler != nil {
		_, err := best.Handler.HandleIntent(ctx, intent)
		return err
	}

	// Handle implicit intent (broadcast)
	if best.Receiver != nil {
		best.Receiver.OnReceive(svcCtx, intent)
		return nil
	}

	return &IntentError{
		Intent: intent,
		Err:    "no handler available",
	}
}

// BroadcastIntent sends an intent to all matching receivers.
func (r *IntentRouter) BroadcastIntent(ctx context.Context, svcCtx ServiceContext, intent *Intent) []error {
	resolved := r.ResolveIntent(intent)
	if len(resolved) == 0 {
		return nil // No receivers is not an error for broadcasts
	}

	// Check if we should only deliver to registered receivers
	if intent.HasFlag(FlagReceiverRegisteredOnly) {
		var filtered []*ResolveInfo
		for _, ri := range resolved {
			if ri.Receiver != nil {
				filtered = append(filtered, ri)
			}
		}
		resolved = filtered
	}

	var errors []error
	for _, ri := range resolved {
		if ri.Receiver != nil {
			// Wrap in recover to prevent one receiver from crashing others
			func() {
				defer func() {
					if r := recover(); r != nil {
						errors = append(errors, fmt.Errorf("receiver %s panicked: %v", ri.ReceiverID, r))
					}
				}()
				ri.Receiver.OnReceive(svcCtx, intent)
			}()
		}
	}

	return errors
}

// StartService routes an explicit intent to start a service.
func (r *IntentRouter) StartService(ctx context.Context, intent *Intent) (*IntentResult, error) {
	if !intent.IsExplicit() {
		return nil, &IntentError{
			Intent: intent,
			Err:    "StartService requires an explicit intent",
		}
	}

	r.mu.RLock()
	handler, ok := r.components[intent.Component]
	r.mu.RUnlock()

	if !ok {
		return nil, &IntentError{
			Intent: intent,
			Err:    fmt.Sprintf("component not found: %s", intent.Component),
		}
	}

	return handler.HandleIntent(ctx, intent)
}

// QueryIntentReceivers returns all receivers that can handle an intent.
func (r *IntentRouter) QueryIntentReceivers(intent *Intent) []*ResolveInfo {
	return r.ResolveIntent(intent)
}

// GetRegisteredReceivers returns all registered receiver IDs.
func (r *IntentRouter) GetRegisteredReceivers() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ids := make([]string, 0, len(r.receivers))
	for id := range r.receivers {
		ids = append(ids, id)
	}
	return ids
}

// GetRegisteredComponents returns all registered component names.
func (r *IntentRouter) GetRegisteredComponents() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	names := make([]string, 0, len(r.components))
	for name := range r.components {
		names = append(names, name)
	}
	return names
}

// IntentError represents an error during intent routing.
type IntentError struct {
	Intent *Intent
	Err    string
}

func (e *IntentError) Error() string {
	if e.Intent != nil {
		if e.Intent.Action != "" {
			return fmt.Sprintf("intent error [action=%s]: %s", e.Intent.Action, e.Err)
		}
		if e.Intent.Component != "" {
			return fmt.Sprintf("intent error [component=%s]: %s", e.Intent.Component, e.Err)
		}
	}
	return fmt.Sprintf("intent error: %s", e.Err)
}

// actionToPermission maps standard actions to required permissions.
func actionToPermission(action string) string {
	switch action {
	case ActionProcess, ActionRun:
		return PermissionExecuteFunctions
	case ActionSend:
		return PermissionPublishEvents
	case ActionSync:
		return PermissionPushData
	default:
		return ""
	}
}

// IntentService provides a high-level API for intent operations.
// It combines the router with a service context.
type IntentService struct {
	router *IntentRouter
	ctx    ServiceContext
}

// NewIntentService creates a new IntentService.
func NewIntentService(router *IntentRouter, ctx ServiceContext) *IntentService {
	return &IntentService{
		router: router,
		ctx:    ctx,
	}
}

// StartService starts a service with an explicit intent.
func (s *IntentService) StartService(intent *Intent) (*IntentResult, error) {
	intent.SourcePackage = s.ctx.PackageName()
	return s.router.StartService(s.ctx.Context(), intent)
}

// SendBroadcast sends a broadcast intent.
func (s *IntentService) SendBroadcast(intent *Intent) []error {
	intent.SourcePackage = s.ctx.PackageName()
	return s.router.BroadcastIntent(s.ctx.Context(), s.ctx, intent)
}

// SendOrderedBroadcast sends a broadcast that is delivered to receivers in priority order.
func (s *IntentService) SendOrderedBroadcast(intent *Intent) error {
	intent.SourcePackage = s.ctx.PackageName()
	return s.router.RouteIntent(s.ctx.Context(), s.ctx, intent)
}

// RegisterReceiver registers a broadcast receiver.
func (s *IntentService) RegisterReceiver(id string, receiver BroadcastReceiver, filters ...*IntentFilter) {
	s.router.RegisterReceiver(id, receiver, s.ctx.PackageName(), filters...)
}

// UnregisterReceiver unregisters a broadcast receiver.
func (s *IntentService) UnregisterReceiver(id string) {
	s.router.UnregisterReceiver(id)
}
