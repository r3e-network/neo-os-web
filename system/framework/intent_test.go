package framework

import (
	"testing"
)

func TestIntent_Creation(t *testing.T) {
	intent := NewIntent(ActionView)

	if intent.Action != ActionView {
		t.Errorf("expected action '%s', got '%s'", ActionView, intent.Action)
	}

	if intent.IsExplicit() {
		t.Error("intent should not be explicit")
	}
}

func TestIntent_ExplicitIntent(t *testing.T) {
	intent := NewExplicitIntent("com.r3e.services.oracle")

	if intent.Component != "com.r3e.services.oracle" {
		t.Errorf("expected component 'com.r3e.services.oracle', got '%s'", intent.Component)
	}

	if !intent.IsExplicit() {
		t.Error("intent should be explicit")
	}
}

func TestIntent_Chaining(t *testing.T) {
	intent := NewIntent(ActionProcess).
		SetComponent("com.r3e.services.functions").
		AddCategory(CategoryDefault).
		SetData("data://test/path").
		SetType("application/json").
		PutExtra("key1", "value1").
		PutExtra("key2", 42).
		AddFlags(FlagReceiverForeground)

	if intent.Action != ActionProcess {
		t.Errorf("expected action '%s', got '%s'", ActionProcess, intent.Action)
	}

	if intent.Component != "com.r3e.services.functions" {
		t.Errorf("expected component 'com.r3e.services.functions', got '%s'", intent.Component)
	}

	if !intent.HasCategory(CategoryDefault) {
		t.Error("intent should have CategoryDefault")
	}

	if intent.Data != "data://test/path" {
		t.Errorf("expected data 'data://test/path', got '%s'", intent.Data)
	}

	if intent.Type != "application/json" {
		t.Errorf("expected type 'application/json', got '%s'", intent.Type)
	}

	if intent.GetStringExtra("key1") != "value1" {
		t.Errorf("expected extra 'value1', got '%s'", intent.GetStringExtra("key1"))
	}

	if intent.GetIntExtra("key2", 0) != 42 {
		t.Errorf("expected extra 42, got %d", intent.GetIntExtra("key2", 0))
	}

	if !intent.HasFlag(FlagReceiverForeground) {
		t.Error("intent should have FlagReceiverForeground")
	}
}

func TestIntent_Clone(t *testing.T) {
	original := NewIntent(ActionView).
		SetComponent("com.r3e.services.test").
		AddCategory(CategoryDefault).
		PutExtra("key", "value")

	clone := original.Clone()

	// Modify original
	original.Action = ActionEdit
	original.Extras["key"] = "modified"

	// Clone should be unchanged
	if clone.Action != ActionView {
		t.Errorf("clone action should be '%s', got '%s'", ActionView, clone.Action)
	}

	if clone.GetStringExtra("key") != "value" {
		t.Errorf("clone extra should be 'value', got '%s'", clone.GetStringExtra("key"))
	}
}

func TestIntentFilter_Match(t *testing.T) {
	tests := []struct {
		name     string
		filter   *IntentFilter
		intent   *Intent
		expected bool
	}{
		{
			name:     "action match",
			filter:   NewIntentFilterWithAction(ActionView),
			intent:   NewIntent(ActionView),
			expected: true,
		},
		{
			name:     "action mismatch",
			filter:   NewIntentFilterWithAction(ActionView),
			intent:   NewIntent(ActionEdit),
			expected: false,
		},
		{
			name: "category match",
			filter: NewIntentFilter().
				AddAction(ActionView).
				AddCategory(CategoryDefault),
			intent: NewIntent(ActionView).AddCategory(CategoryDefault),
			expected: true,
		},
		{
			name: "category mismatch",
			filter: NewIntentFilter().
				AddAction(ActionView).
				AddCategory(CategoryLauncher),
			intent: NewIntent(ActionView).AddCategory(CategoryDefault),
			expected: false,
		},
		{
			name: "data scheme match",
			filter: NewIntentFilter().
				AddAction(ActionView).
				AddDataScheme("http"),
			intent: NewIntent(ActionView).SetData("http://example.com/path"),
			expected: true,
		},
		{
			name: "data scheme mismatch",
			filter: NewIntentFilter().
				AddAction(ActionView).
				AddDataScheme("https"),
			intent: NewIntent(ActionView).SetData("http://example.com/path"),
			expected: false,
		},
		{
			name: "mime type match",
			filter: NewIntentFilter().
				AddAction(ActionView).
				AddDataType("application/json"),
			intent: NewIntent(ActionView).SetType("application/json"),
			expected: true,
		},
		{
			name: "mime type wildcard match",
			filter: NewIntentFilter().
				AddAction(ActionView).
				AddDataType("application/*"),
			intent: NewIntent(ActionView).SetType("application/json"),
			expected: true,
		},
		{
			name: "mime type mismatch",
			filter: NewIntentFilter().
				AddAction(ActionView).
				AddDataType("text/plain"),
			intent: NewIntent(ActionView).SetType("application/json"),
			expected: false,
		},
		{
			name:     "empty filter matches all",
			filter:   NewIntentFilter(),
			intent:   NewIntent(ActionView),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := tt.filter.Match(tt.intent)
			matched := score > 0

			if matched != tt.expected {
				t.Errorf("expected match=%v, got match=%v (score=%d)", tt.expected, matched, score)
			}
		})
	}
}

func TestIntentFilter_Priority(t *testing.T) {
	filter1 := NewIntentFilterWithAction(ActionView).SetPriority(10)
	filter2 := NewIntentFilterWithAction(ActionView).SetPriority(20)

	intent := NewIntent(ActionView)

	score1 := filter1.Match(intent)
	score2 := filter2.Match(intent)

	if score2 <= score1 {
		t.Errorf("higher priority filter should have higher score: score1=%d, score2=%d", score1, score2)
	}
}

func TestIntentFilter_Clone(t *testing.T) {
	original := NewIntentFilter().
		AddAction(ActionView).
		AddCategory(CategoryDefault).
		SetPriority(10)

	clone := original.Clone()

	// Modify original
	original.Actions = append(original.Actions, ActionEdit)
	original.Priority = 20

	// Clone should be unchanged
	if len(clone.Actions) != 1 {
		t.Errorf("clone should have 1 action, got %d", len(clone.Actions))
	}

	if clone.Priority != 10 {
		t.Errorf("clone priority should be 10, got %d", clone.Priority)
	}
}

func TestParseDataURI(t *testing.T) {
	tests := []struct {
		data           string
		expectedScheme string
		expectedHost   string
		expectedPath   string
	}{
		{"http://example.com/path", "http", "example.com", "/path"},
		{"https://api.example.com/v1/data", "https", "api.example.com", "/v1/data"},
		{"file:///local/path", "file", "", "/local/path"},
		{"/just/a/path", "", "", "/just/a/path"},
	}

	for _, tt := range tests {
		t.Run(tt.data, func(t *testing.T) {
			scheme, host, path := parseDataURI(tt.data)

			if scheme != tt.expectedScheme {
				t.Errorf("expected scheme '%s', got '%s'", tt.expectedScheme, scheme)
			}
			if host != tt.expectedHost {
				t.Errorf("expected host '%s', got '%s'", tt.expectedHost, host)
			}
			if path != tt.expectedPath {
				t.Errorf("expected path '%s', got '%s'", tt.expectedPath, path)
			}
		})
	}
}

func TestMatchMimeType(t *testing.T) {
	tests := []struct {
		pattern  string
		value    string
		expected bool
	}{
		{"*/*", "application/json", true},
		{"application/*", "application/json", true},
		{"application/*", "text/plain", false},
		{"*/json", "application/json", true},
		{"application/json", "application/json", true},
		{"application/json", "application/xml", false},
	}

	for _, tt := range tests {
		t.Run(tt.pattern+"_"+tt.value, func(t *testing.T) {
			result := matchMimeType(tt.pattern, tt.value)
			if result != tt.expected {
				t.Errorf("matchMimeType(%s, %s) = %v, expected %v", tt.pattern, tt.value, result, tt.expected)
			}
		})
	}
}
