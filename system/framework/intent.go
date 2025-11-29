// Package framework provides the Intent and IntentFilter types.
// Intent is inspired by Android's Intent class, providing a messaging object
// for requesting actions from other services or broadcasting events.
package framework

import (
	"strings"
)

// Intent represents a messaging object used to request an action from another
// service component. It is inspired by Android's Intent class.
//
// Intents can be used for:
// - Starting services (explicit intent with Component set)
// - Broadcasting events (implicit intent with Action set)
// - Passing data between services (via Extras)
type Intent struct {
	// Action is the general action to be performed (e.g., "com.r3e.action.PROCESS_DATA").
	Action string

	// Component is the explicit target service (e.g., "com.r3e.services.oracle").
	// If set, this is an explicit intent.
	Component string

	// Category adds additional information about the kind of component that should handle the intent.
	Categories []string

	// Data is a URI-like string identifying the data to operate on.
	Data string

	// Type is the MIME type of the data.
	Type string

	// Extras contains additional key-value data to pass with the intent.
	Extras map[string]any

	// Flags control how the intent is handled.
	Flags IntentFlags

	// SourcePackage identifies the package that created this intent.
	SourcePackage string
}

// IntentFlags control how intents are handled.
type IntentFlags uint32

const (
	// FlagActivityNewTask starts the activity in a new task.
	FlagActivityNewTask IntentFlags = 1 << iota
	// FlagIncludeStoppedPackages allows the intent to be delivered to stopped packages.
	FlagIncludeStoppedPackages
	// FlagExcludeStoppedPackages prevents delivery to stopped packages.
	FlagExcludeStoppedPackages
	// FlagGrantReadPermission grants read permission to the receiver.
	FlagGrantReadPermission
	// FlagGrantWritePermission grants write permission to the receiver.
	FlagGrantWritePermission
	// FlagReceiverForeground indicates the receiver should run in foreground.
	FlagReceiverForeground
	// FlagReceiverRegisteredOnly only delivers to registered receivers.
	FlagReceiverRegisteredOnly
)

// Standard Actions (similar to Android's standard actions)
const (
	// ActionMain is the main entry point action.
	ActionMain = "com.r3e.action.MAIN"
	// ActionView displays data to the user.
	ActionView = "com.r3e.action.VIEW"
	// ActionEdit allows editing of data.
	ActionEdit = "com.r3e.action.EDIT"
	// ActionSend sends data to another service.
	ActionSend = "com.r3e.action.SEND"
	// ActionSync synchronizes data.
	ActionSync = "com.r3e.action.SYNC"
	// ActionRun executes a function or task.
	ActionRun = "com.r3e.action.RUN"
	// ActionProcess processes data.
	ActionProcess = "com.r3e.action.PROCESS"
	// ActionBootCompleted is broadcast when the system has finished booting.
	ActionBootCompleted = "com.r3e.action.BOOT_COMPLETED"
	// ActionShutdown is broadcast when the system is shutting down.
	ActionShutdown = "com.r3e.action.SHUTDOWN"
	// ActionPackageAdded is broadcast when a new package is installed.
	ActionPackageAdded = "com.r3e.action.PACKAGE_ADDED"
	// ActionPackageRemoved is broadcast when a package is removed.
	ActionPackageRemoved = "com.r3e.action.PACKAGE_REMOVED"
	// ActionPackageReplaced is broadcast when a package is updated.
	ActionPackageReplaced = "com.r3e.action.PACKAGE_REPLACED"
	// ActionConfigurationChanged is broadcast when configuration changes.
	ActionConfigurationChanged = "com.r3e.action.CONFIGURATION_CHANGED"
	// ActionHealthCheck requests a health check.
	ActionHealthCheck = "com.r3e.action.HEALTH_CHECK"
)

// Standard Categories
const (
	// CategoryDefault is the default category.
	CategoryDefault = "com.r3e.category.DEFAULT"
	// CategoryLauncher indicates a launchable service.
	CategoryLauncher = "com.r3e.category.LAUNCHER"
	// CategoryInfo indicates an informational service.
	CategoryInfo = "com.r3e.category.INFO"
	// CategoryBrowsable indicates a browsable service.
	CategoryBrowsable = "com.r3e.category.BROWSABLE"
)

// NewIntent creates a new Intent with the given action.
func NewIntent(action string) *Intent {
	return &Intent{
		Action: action,
		Extras: make(map[string]any),
	}
}

// NewExplicitIntent creates an explicit intent targeting a specific component.
func NewExplicitIntent(component string) *Intent {
	return &Intent{
		Component: component,
		Extras:    make(map[string]any),
	}
}

// SetAction sets the action and returns the intent for chaining.
func (i *Intent) SetAction(action string) *Intent {
	i.Action = action
	return i
}

// SetComponent sets the target component and returns the intent for chaining.
func (i *Intent) SetComponent(component string) *Intent {
	i.Component = component
	return i
}

// AddCategory adds a category and returns the intent for chaining.
func (i *Intent) AddCategory(category string) *Intent {
	i.Categories = append(i.Categories, category)
	return i
}

// SetData sets the data URI and returns the intent for chaining.
func (i *Intent) SetData(data string) *Intent {
	i.Data = data
	return i
}

// SetType sets the MIME type and returns the intent for chaining.
func (i *Intent) SetType(mimeType string) *Intent {
	i.Type = mimeType
	return i
}

// SetDataAndType sets both data and type and returns the intent for chaining.
func (i *Intent) SetDataAndType(data, mimeType string) *Intent {
	i.Data = data
	i.Type = mimeType
	return i
}

// PutExtra adds an extra value and returns the intent for chaining.
func (i *Intent) PutExtra(key string, value any) *Intent {
	if i.Extras == nil {
		i.Extras = make(map[string]any)
	}
	i.Extras[key] = value
	return i
}

// PutExtras adds multiple extra values and returns the intent for chaining.
func (i *Intent) PutExtras(extras map[string]any) *Intent {
	if i.Extras == nil {
		i.Extras = make(map[string]any)
	}
	for k, v := range extras {
		i.Extras[k] = v
	}
	return i
}

// GetExtra returns an extra value by key.
func (i *Intent) GetExtra(key string) (any, bool) {
	if i.Extras == nil {
		return nil, false
	}
	v, ok := i.Extras[key]
	return v, ok
}

// GetStringExtra returns a string extra value.
func (i *Intent) GetStringExtra(key string) string {
	if v, ok := i.GetExtra(key); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// GetIntExtra returns an int extra value with a default.
func (i *Intent) GetIntExtra(key string, defaultValue int) int {
	if v, ok := i.GetExtra(key); ok {
		switch n := v.(type) {
		case int:
			return n
		case int64:
			return int(n)
		case float64:
			return int(n)
		}
	}
	return defaultValue
}

// GetBoolExtra returns a bool extra value with a default.
func (i *Intent) GetBoolExtra(key string, defaultValue bool) bool {
	if v, ok := i.GetExtra(key); ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return defaultValue
}

// AddFlags adds flags and returns the intent for chaining.
func (i *Intent) AddFlags(flags IntentFlags) *Intent {
	i.Flags |= flags
	return i
}

// HasFlag checks if a flag is set.
func (i *Intent) HasFlag(flag IntentFlags) bool {
	return i.Flags&flag != 0
}

// IsExplicit returns true if this is an explicit intent (has a component).
func (i *Intent) IsExplicit() bool {
	return i.Component != ""
}

// HasCategory checks if the intent has a specific category.
func (i *Intent) HasCategory(category string) bool {
	for _, c := range i.Categories {
		if c == category {
			return true
		}
	}
	return false
}

// Clone creates a deep copy of the intent.
func (i *Intent) Clone() *Intent {
	clone := &Intent{
		Action:        i.Action,
		Component:     i.Component,
		Categories:    make([]string, len(i.Categories)),
		Data:          i.Data,
		Type:          i.Type,
		Extras:        make(map[string]any, len(i.Extras)),
		Flags:         i.Flags,
		SourcePackage: i.SourcePackage,
	}
	copy(clone.Categories, i.Categories)
	for k, v := range i.Extras {
		clone.Extras[k] = v
	}
	return clone
}

// IntentFilter specifies the types of intents that a component can respond to.
// It is inspired by Android's IntentFilter class.
type IntentFilter struct {
	// Actions that this filter matches.
	Actions []string

	// Categories that this filter matches.
	Categories []string

	// DataSchemes that this filter matches (e.g., "http", "file").
	DataSchemes []string

	// DataHosts that this filter matches.
	DataHosts []string

	// DataPaths that this filter matches.
	DataPaths []string

	// DataTypes (MIME types) that this filter matches.
	DataTypes []string

	// Priority determines the order in which filters are evaluated.
	// Higher priority filters are evaluated first.
	Priority int
}

// NewIntentFilter creates a new IntentFilter.
func NewIntentFilter() *IntentFilter {
	return &IntentFilter{}
}

// NewIntentFilterWithAction creates a new IntentFilter with an action.
func NewIntentFilterWithAction(action string) *IntentFilter {
	return &IntentFilter{
		Actions: []string{action},
	}
}

// AddAction adds an action to the filter.
func (f *IntentFilter) AddAction(action string) *IntentFilter {
	f.Actions = append(f.Actions, action)
	return f
}

// AddCategory adds a category to the filter.
func (f *IntentFilter) AddCategory(category string) *IntentFilter {
	f.Categories = append(f.Categories, category)
	return f
}

// AddDataScheme adds a data scheme to the filter.
func (f *IntentFilter) AddDataScheme(scheme string) *IntentFilter {
	f.DataSchemes = append(f.DataSchemes, scheme)
	return f
}

// AddDataHost adds a data host to the filter.
func (f *IntentFilter) AddDataHost(host string) *IntentFilter {
	f.DataHosts = append(f.DataHosts, host)
	return f
}

// AddDataPath adds a data path to the filter.
func (f *IntentFilter) AddDataPath(path string) *IntentFilter {
	f.DataPaths = append(f.DataPaths, path)
	return f
}

// AddDataType adds a MIME type to the filter.
func (f *IntentFilter) AddDataType(mimeType string) *IntentFilter {
	f.DataTypes = append(f.DataTypes, mimeType)
	return f
}

// SetPriority sets the filter priority.
func (f *IntentFilter) SetPriority(priority int) *IntentFilter {
	f.Priority = priority
	return f
}

// Match checks if an intent matches this filter.
// Returns a match score (higher is better) or 0 if no match.
func (f *IntentFilter) Match(intent *Intent) int {
	score := 0

	// Check action match
	if intent.Action != "" {
		if !f.matchAction(intent.Action) {
			return 0
		}
		score += 100
	}

	// Check category match
	for _, cat := range intent.Categories {
		if !f.matchCategory(cat) {
			return 0
		}
		score += 10
	}

	// Check data match
	if intent.Data != "" {
		if !f.matchData(intent.Data) {
			return 0
		}
		score += 50
	}

	// Check type match
	if intent.Type != "" {
		if !f.matchType(intent.Type) {
			return 0
		}
		score += 50
	}

	// Add priority to score
	score += f.Priority

	return score
}

// matchAction checks if the action matches any filter action.
func (f *IntentFilter) matchAction(action string) bool {
	if len(f.Actions) == 0 {
		return true // No action filter means match all
	}
	for _, a := range f.Actions {
		if a == action || matchWildcard(a, action) {
			return true
		}
	}
	return false
}

// matchCategory checks if the category matches any filter category.
func (f *IntentFilter) matchCategory(category string) bool {
	if len(f.Categories) == 0 {
		return true // No category filter means match all
	}
	for _, c := range f.Categories {
		if c == category || matchWildcard(c, category) {
			return true
		}
	}
	return false
}

// matchData checks if the data URI matches the filter.
func (f *IntentFilter) matchData(data string) bool {
	if len(f.DataSchemes) == 0 && len(f.DataHosts) == 0 && len(f.DataPaths) == 0 {
		return true // No data filter means match all
	}

	// Parse data URI (simplified)
	scheme, host, path := parseDataURI(data)

	// Check scheme
	if len(f.DataSchemes) > 0 {
		matched := false
		for _, s := range f.DataSchemes {
			if s == scheme {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check host
	if len(f.DataHosts) > 0 {
		matched := false
		for _, h := range f.DataHosts {
			if h == host || matchWildcard(h, host) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// Check path
	if len(f.DataPaths) > 0 {
		matched := false
		for _, p := range f.DataPaths {
			if p == path || matchWildcard(p, path) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

// matchType checks if the MIME type matches the filter.
func (f *IntentFilter) matchType(mimeType string) bool {
	if len(f.DataTypes) == 0 {
		return true // No type filter means match all
	}
	for _, t := range f.DataTypes {
		if t == mimeType || matchMimeType(t, mimeType) {
			return true
		}
	}
	return false
}

// HasAction checks if the filter has a specific action.
func (f *IntentFilter) HasAction(action string) bool {
	for _, a := range f.Actions {
		if a == action {
			return true
		}
	}
	return false
}

// HasCategory checks if the filter has a specific category.
func (f *IntentFilter) HasCategory(category string) bool {
	for _, c := range f.Categories {
		if c == category {
			return true
		}
	}
	return false
}

// Clone creates a deep copy of the filter.
func (f *IntentFilter) Clone() *IntentFilter {
	clone := &IntentFilter{
		Actions:     make([]string, len(f.Actions)),
		Categories:  make([]string, len(f.Categories)),
		DataSchemes: make([]string, len(f.DataSchemes)),
		DataHosts:   make([]string, len(f.DataHosts)),
		DataPaths:   make([]string, len(f.DataPaths)),
		DataTypes:   make([]string, len(f.DataTypes)),
		Priority:    f.Priority,
	}
	copy(clone.Actions, f.Actions)
	copy(clone.Categories, f.Categories)
	copy(clone.DataSchemes, f.DataSchemes)
	copy(clone.DataHosts, f.DataHosts)
	copy(clone.DataPaths, f.DataPaths)
	copy(clone.DataTypes, f.DataTypes)
	return clone
}

// Helper functions

// parseDataURI parses a data URI into scheme, host, and path.
func parseDataURI(data string) (scheme, host, path string) {
	// Simple URI parsing
	if idx := strings.Index(data, "://"); idx != -1 {
		scheme = data[:idx]
		rest := data[idx+3:]
		if pathIdx := strings.Index(rest, "/"); pathIdx != -1 {
			host = rest[:pathIdx]
			path = rest[pathIdx:]
		} else {
			host = rest
		}
	} else {
		path = data
	}
	return
}

// matchWildcard checks if a pattern with wildcards matches a value.
func matchWildcard(pattern, value string) bool {
	if pattern == "*" {
		return true
	}
	if strings.HasSuffix(pattern, "*") {
		return strings.HasPrefix(value, pattern[:len(pattern)-1])
	}
	if strings.HasPrefix(pattern, "*") {
		return strings.HasSuffix(value, pattern[1:])
	}
	return pattern == value
}

// matchMimeType checks if a MIME type pattern matches a value.
func matchMimeType(pattern, value string) bool {
	if pattern == "*/*" {
		return true
	}
	patternParts := strings.SplitN(pattern, "/", 2)
	valueParts := strings.SplitN(value, "/", 2)
	if len(patternParts) != 2 || len(valueParts) != 2 {
		return pattern == value
	}
	if patternParts[0] != "*" && patternParts[0] != valueParts[0] {
		return false
	}
	if patternParts[1] != "*" && patternParts[1] != valueParts[1] {
		return false
	}
	return true
}
