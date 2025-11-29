package framework

import (
	"context"
	"testing"
	"time"
)

func TestBaseContext_PackageName(t *testing.T) {
	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.test",
	})

	if ctx.PackageName() != "com.r3e.services.test" {
		t.Errorf("expected package name 'com.r3e.services.test', got '%s'", ctx.PackageName())
	}
}

func TestBaseContext_SystemService(t *testing.T) {
	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.test",
	})

	// Set a mock service
	mockBus := &mockBusClient{}
	ctx.SetSystemService(SystemServiceBus, mockBus)

	// Get the service
	svc := ctx.GetSystemService(SystemServiceBus)
	if svc == nil {
		t.Error("expected system service, got nil")
	}

	// Get bus shorthand
	bus := ctx.GetBus()
	if bus == nil {
		t.Error("expected bus client, got nil")
	}
}

func TestBaseContext_Config(t *testing.T) {
	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.test",
		Config: map[string]any{
			"string_key": "value",
			"int_key":    42,
			"bool_key":   true,
		},
	})

	if ctx.GetString("string_key") != "value" {
		t.Errorf("expected 'value', got '%s'", ctx.GetString("string_key"))
	}

	if ctx.GetInt("int_key") != 42 {
		t.Errorf("expected 42, got %d", ctx.GetInt("int_key"))
	}

	if !ctx.GetBool("bool_key") {
		t.Error("expected true, got false")
	}

	// Test missing keys
	if ctx.GetString("missing") != "" {
		t.Error("expected empty string for missing key")
	}

	if ctx.GetInt("missing") != 0 {
		t.Error("expected 0 for missing key")
	}

	if ctx.GetBool("missing") {
		t.Error("expected false for missing key")
	}
}

func TestBaseContext_Permissions(t *testing.T) {
	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.test",
	})

	// Initially unknown
	if ctx.CheckPermission("test.permission") != PermissionUnknown {
		t.Error("expected PermissionUnknown for unset permission")
	}

	// Grant permission
	ctx.GrantPermission("test.permission")
	if ctx.CheckPermission("test.permission") != PermissionGranted {
		t.Error("expected PermissionGranted after grant")
	}

	// Deny permission
	ctx.DenyPermission("test.permission")
	if ctx.CheckPermission("test.permission") != PermissionDenied {
		t.Error("expected PermissionDenied after deny")
	}
}

func TestBaseContext_WithTimeout(t *testing.T) {
	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.test",
	})

	newCtx, cancel := ctx.WithTimeout(100 * time.Millisecond)
	defer cancel()

	select {
	case <-newCtx.Context().Done():
		t.Error("context should not be done yet")
	default:
		// OK
	}

	time.Sleep(150 * time.Millisecond)

	select {
	case <-newCtx.Context().Done():
		// OK - context should be done
	default:
		t.Error("context should be done after timeout")
	}
}

func TestBaseContext_WithCancel(t *testing.T) {
	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.test",
	})

	newCtx, cancel := ctx.WithCancel()

	select {
	case <-newCtx.Context().Done():
		t.Error("context should not be done yet")
	default:
		// OK
	}

	cancel()

	select {
	case <-newCtx.Context().Done():
		// OK - context should be done
	default:
		t.Error("context should be done after cancel")
	}
}

func TestBaseContext_BroadcastReceiver(t *testing.T) {
	ctx := NewBaseContext(BaseContextConfig{
		PackageName: "com.r3e.services.test",
	})

	receiver := &mockBroadcastReceiver{}
	filter := NewIntentFilterWithAction("test.action")

	err := ctx.RegisterReceiver(receiver, filter)
	if err != nil {
		t.Errorf("unexpected error registering receiver: %v", err)
	}

	err = ctx.UnregisterReceiver(receiver)
	if err != nil {
		t.Errorf("unexpected error unregistering receiver: %v", err)
	}
}

// Mock types for testing

type mockBusClient struct{}

func (m *mockBusClient) PublishEvent(ctx context.Context, event string, payload any) error {
	return nil
}

func (m *mockBusClient) PushData(ctx context.Context, topic string, payload any) error {
	return nil
}

func (m *mockBusClient) InvokeCompute(ctx context.Context, payload any) ([]ComputeResult, error) {
	return nil, nil
}

type mockBroadcastReceiver struct{}

func (m *mockBroadcastReceiver) OnReceive(ctx ServiceContext, intent *Intent) {}
