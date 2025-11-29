package framework

import (
	"context"
	"testing"
)

func TestIntentRouter_RegisterReceiver(t *testing.T) {
	router := NewIntentRouter()

	receiver := &testReceiver{}
	filter := NewIntentFilterWithAction(ActionView)

	router.RegisterReceiver("test-receiver", receiver, "com.r3e.test", filter)

	receivers := router.GetRegisteredReceivers()
	if len(receivers) != 1 {
		t.Errorf("expected 1 receiver, got %d", len(receivers))
	}

	if receivers[0] != "test-receiver" {
		t.Errorf("expected 'test-receiver', got '%s'", receivers[0])
	}
}

func TestIntentRouter_UnregisterReceiver(t *testing.T) {
	router := NewIntentRouter()

	receiver := &testReceiver{}
	filter := NewIntentFilterWithAction(ActionView)

	router.RegisterReceiver("test-receiver", receiver, "com.r3e.test", filter)
	router.UnregisterReceiver("test-receiver")

	receivers := router.GetRegisteredReceivers()
	if len(receivers) != 0 {
		t.Errorf("expected 0 receivers, got %d", len(receivers))
	}
}

func TestIntentRouter_RegisterComponent(t *testing.T) {
	router := NewIntentRouter()

	handler := &testHandler{}
	router.RegisterComponent("com.r3e.services.test", handler)

	components := router.GetRegisteredComponents()
	if len(components) != 1 {
		t.Errorf("expected 1 component, got %d", len(components))
	}
}

func TestIntentRouter_ResolveExplicitIntent(t *testing.T) {
	router := NewIntentRouter()

	handler := &testHandler{}
	router.RegisterComponent("com.r3e.services.test", handler)

	intent := NewExplicitIntent("com.r3e.services.test")
	resolved := router.ResolveIntent(intent)

	if len(resolved) != 1 {
		t.Errorf("expected 1 resolved, got %d", len(resolved))
	}

	if resolved[0].Component != "com.r3e.services.test" {
		t.Errorf("expected component 'com.r3e.services.test', got '%s'", resolved[0].Component)
	}
}

func TestIntentRouter_ResolveImplicitIntent(t *testing.T) {
	router := NewIntentRouter()

	receiver1 := &testReceiver{name: "receiver1"}
	receiver2 := &testReceiver{name: "receiver2"}

	filter1 := NewIntentFilterWithAction(ActionView).SetPriority(10)
	filter2 := NewIntentFilterWithAction(ActionView).SetPriority(20)

	router.RegisterReceiver("r1", receiver1, "com.r3e.test1", filter1)
	router.RegisterReceiver("r2", receiver2, "com.r3e.test2", filter2)

	intent := NewIntent(ActionView)
	resolved := router.ResolveIntent(intent)

	if len(resolved) != 2 {
		t.Errorf("expected 2 resolved, got %d", len(resolved))
	}

	// Higher priority should be first
	if resolved[0].ReceiverID != "r2" {
		t.Errorf("expected 'r2' first (higher priority), got '%s'", resolved[0].ReceiverID)
	}
}

func TestIntentRouter_ResolveNoMatch(t *testing.T) {
	router := NewIntentRouter()

	receiver := &testReceiver{}
	filter := NewIntentFilterWithAction(ActionView)

	router.RegisterReceiver("test", receiver, "com.r3e.test", filter)

	intent := NewIntent(ActionEdit) // Different action
	resolved := router.ResolveIntent(intent)

	if len(resolved) != 0 {
		t.Errorf("expected 0 resolved, got %d", len(resolved))
	}
}

func TestIntentRouter_BroadcastIntent(t *testing.T) {
	router := NewIntentRouter()

	receiver1 := &testReceiver{name: "receiver1"}
	receiver2 := &testReceiver{name: "receiver2"}

	filter := NewIntentFilterWithAction(ActionView)

	router.RegisterReceiver("r1", receiver1, "com.r3e.test1", filter)
	router.RegisterReceiver("r2", receiver2, "com.r3e.test2", filter)

	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.sender",
	})

	intent := NewIntent(ActionView).PutExtra("message", "hello")
	errors := router.BroadcastIntent(context.Background(), ctx, intent)

	if len(errors) != 0 {
		t.Errorf("expected no errors, got %v", errors)
	}

	if receiver1.receivedCount != 1 {
		t.Errorf("receiver1 should have received 1 intent, got %d", receiver1.receivedCount)
	}

	if receiver2.receivedCount != 1 {
		t.Errorf("receiver2 should have received 1 intent, got %d", receiver2.receivedCount)
	}
}

func TestIntentRouter_StartService(t *testing.T) {
	router := NewIntentRouter()

	handler := &testHandler{
		result: &IntentResult{
			ResultCode: ResultOK,
			Data:       map[string]any{"status": "started"},
		},
	}
	router.RegisterComponent("com.r3e.services.test", handler)

	intent := NewExplicitIntent("com.r3e.services.test")
	result, err := router.StartService(context.Background(), intent)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if result.ResultCode != ResultOK {
		t.Errorf("expected ResultOK, got %d", result.ResultCode)
	}

	if result.Data["status"] != "started" {
		t.Errorf("expected status 'started', got '%v'", result.Data["status"])
	}
}

func TestIntentRouter_StartServiceImplicitError(t *testing.T) {
	router := NewIntentRouter()

	intent := NewIntent(ActionView) // Implicit intent
	_, err := router.StartService(context.Background(), intent)

	if err == nil {
		t.Error("expected error for implicit intent")
	}
}

func TestIntentRouter_StartServiceNotFound(t *testing.T) {
	router := NewIntentRouter()

	intent := NewExplicitIntent("com.r3e.services.nonexistent")
	_, err := router.StartService(context.Background(), intent)

	if err == nil {
		t.Error("expected error for nonexistent component")
	}
}

func TestIntentRouter_RouteIntent(t *testing.T) {
	router := NewIntentRouter()

	receiver := &testReceiver{name: "test"}
	filter := NewIntentFilterWithAction(ActionProcess)

	router.RegisterReceiver("test", receiver, "com.r3e.test", filter)

	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.sender",
	})

	intent := NewIntent(ActionProcess)
	err := router.RouteIntent(context.Background(), ctx, intent)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if receiver.receivedCount != 1 {
		t.Errorf("receiver should have received 1 intent, got %d", receiver.receivedCount)
	}
}

func TestIntentRouter_RouteIntentNoReceiver(t *testing.T) {
	router := NewIntentRouter()

	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.sender",
	})

	intent := NewIntent(ActionProcess)
	err := router.RouteIntent(context.Background(), ctx, intent)

	if err == nil {
		t.Error("expected error when no receiver found")
	}
}

func TestIntentRouter_WithPermissions(t *testing.T) {
	pm := NewPermissionManager()
	router := NewIntentRouterWithPermissions(pm)

	receiver := &testReceiver{name: "test"}
	filter := NewIntentFilterWithAction(ActionProcess)

	router.RegisterReceiver("test", receiver, "com.r3e.test", filter)

	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.sender",
	})

	// Without permission
	intent := NewIntent(ActionProcess)
	intent.SourcePackage = "com.r3e.sender"
	err := router.RouteIntent(context.Background(), ctx, intent)

	if err == nil {
		t.Error("expected permission denied error")
	}

	// Grant permission
	pm.GrantPermission(context.Background(), "com.r3e.sender", PermissionExecuteFunctions, "system")

	err = router.RouteIntent(context.Background(), ctx, intent)
	if err != nil {
		t.Errorf("unexpected error after granting permission: %v", err)
	}
}

func TestIntentService(t *testing.T) {
	router := NewIntentRouter()

	handler := &testHandler{
		result: &IntentResult{ResultCode: ResultOK},
	}
	router.RegisterComponent("com.r3e.services.target", handler)

	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.sender",
	})

	svc := NewIntentService(router, ctx)

	intent := NewExplicitIntent("com.r3e.services.target")
	result, err := svc.StartService(intent)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if result.ResultCode != ResultOK {
		t.Errorf("expected ResultOK, got %d", result.ResultCode)
	}

	// Verify source package was set
	if intent.SourcePackage != "com.r3e.services.sender" {
		t.Errorf("expected source package 'com.r3e.services.sender', got '%s'", intent.SourcePackage)
	}
}

// Test types

type testReceiver struct {
	name          string
	receivedCount int
	lastIntent    *Intent
}

func (r *testReceiver) OnReceive(ctx ServiceContext, intent *Intent) {
	r.receivedCount++
	r.lastIntent = intent
}

type testHandler struct {
	result      *IntentResult
	err         error
	handleCount int
	lastIntent  *Intent
}

func (h *testHandler) HandleIntent(ctx context.Context, intent *Intent) (*IntentResult, error) {
	h.handleCount++
	h.lastIntent = intent
	if h.err != nil {
		return nil, h.err
	}
	if h.result != nil {
		return h.result, nil
	}
	return &IntentResult{ResultCode: ResultOK}, nil
}
