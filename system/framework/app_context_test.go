package framework

import (
	"context"
	"testing"
)

func TestApplicationContext_Creation(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "ServiceLayer",
		PackageName: "com.r3e.servicelayer",
		Version:     "1.0.0",
		VersionCode: 1,
		Config: map[string]any{
			"debug": true,
		},
	})

	if app.AppName() != "ServiceLayer" {
		t.Errorf("expected app name 'ServiceLayer', got '%s'", app.AppName())
	}

	if app.PackageName() != "com.r3e.servicelayer" {
		t.Errorf("expected package name 'com.r3e.servicelayer', got '%s'", app.PackageName())
	}

	if app.Version() != "1.0.0" {
		t.Errorf("expected version '1.0.0', got '%s'", app.Version())
	}

	if app.VersionCode() != 1 {
		t.Errorf("expected version code 1, got %d", app.VersionCode())
	}
}

func TestApplicationContext_SystemServices(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	// Permission manager should be registered
	pm := app.GetSystemService(SystemServicePermission)
	if pm == nil {
		t.Error("expected permission manager to be registered")
	}

	// Router should be registered
	router := app.GetSystemService(SystemServiceRegistry)
	if router == nil {
		t.Error("expected router to be registered")
	}

	// Direct accessors
	if app.PermissionManager() == nil {
		t.Error("expected PermissionManager() to return non-nil")
	}

	if app.Router() == nil {
		t.Error("expected Router() to return non-nil")
	}

	if app.BroadcastManager() == nil {
		t.Error("expected BroadcastManager() to return non-nil")
	}
}

func TestApplicationContext_CreateServiceContext(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
		Config: map[string]any{
			"shared_config": "value",
		},
	})

	svcCtx := app.CreateServiceContext("com.r3e.services.oracle")

	if svcCtx.PackageName() != "com.r3e.services.oracle" {
		t.Errorf("expected package name 'com.r3e.services.oracle', got '%s'", svcCtx.PackageName())
	}

	// Should inherit config from app
	if svcCtx.GetString("shared_config") != "value" {
		t.Errorf("expected inherited config 'value', got '%s'", svcCtx.GetString("shared_config"))
	}

	// Should have app context reference
	if svcCtx.GetApplicationContext() != app {
		t.Error("expected GetApplicationContext() to return app")
	}
}

func TestApplicationContext_RegisterService(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	handler := &testAppHandler{
		result: &IntentResult{ResultCode: ResultOK},
	}

	filter := NewIntentFilterWithAction(ActionProcess)

	svcCtx := app.RegisterService("com.r3e.services.test", handler, filter)

	if svcCtx == nil {
		t.Error("expected service context to be created")
	}

	// Should be able to start the service
	intent := NewExplicitIntent("com.r3e.services.test")
	result, err := app.StartService(intent)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if result.ResultCode != ResultOK {
		t.Errorf("expected ResultOK, got %d", result.ResultCode)
	}

	if handler.handleCount != 1 {
		t.Errorf("expected handler to be called once, got %d", handler.handleCount)
	}
}

func TestApplicationContext_UnregisterService(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	handler := &testAppHandler{}
	app.RegisterService("com.r3e.services.test", handler)

	app.UnregisterService("com.r3e.services.test")

	// Should not be able to start the service anymore
	intent := NewExplicitIntent("com.r3e.services.test")
	_, err := app.StartService(intent)

	if err == nil {
		t.Error("expected error after unregistering service")
	}
}

func TestApplicationContext_Permissions(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	svcCtx := app.CreateServiceContext("com.r3e.services.oracle")

	// Initially no permission
	result := svcCtx.CheckPermission(PermissionAccessRPC)
	if result == PermissionGranted {
		t.Error("expected permission to not be granted initially")
	}

	// Grant permission
	err := app.GrantServicePermission("com.r3e.services.oracle", PermissionAccessRPC)
	if err != nil {
		t.Errorf("unexpected error granting permission: %v", err)
	}

	// Now should have permission
	result = svcCtx.CheckPermission(PermissionAccessRPC)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted, got %v", result)
	}
}

func TestApplicationContext_GrantAllPermissions(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	svcCtx := app.CreateServiceContext("com.r3e.services.system")

	// Grant all permissions
	err := app.GrantServiceAllPermissions("com.r3e.services.system")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Should have any permission now (admin grants all)
	result := svcCtx.CheckPermission(PermissionAccessRPC)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted after granting all, got %v", result)
	}
}

func TestApplicationContext_Broadcast(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	received := false
	receiver := &testAppReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			received = true
		},
	}

	filter := NewIntentFilterWithAction("com.r3e.action.TEST")
	app.Router().RegisterReceiver("test-receiver", receiver, "com.r3e.test", filter)

	intent := NewIntent("com.r3e.action.TEST")
	errors := app.SendBroadcast(intent)

	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if !received {
		t.Error("expected receiver to receive broadcast")
	}
}

func TestApplicationContext_BootAndShutdown(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bootReceived := false
	shutdownReceived := false

	receiver := &testAppReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionBootCompleted {
				bootReceived = true
			}
			if intent.Action == ActionShutdown {
				shutdownReceived = true
			}
		},
	}

	bootFilter := NewIntentFilterWithAction(ActionBootCompleted)
	shutdownFilter := NewIntentFilterWithAction(ActionShutdown)

	app.Router().RegisterReceiver("boot-receiver", receiver, "com.r3e.test", bootFilter, shutdownFilter)

	// Trigger boot
	app.OnBootCompleted()
	if !bootReceived {
		t.Error("expected boot completed broadcast to be received")
	}

	// Trigger shutdown
	app.OnShutdown()
	if !shutdownReceived {
		t.Error("expected shutdown broadcast to be received")
	}
}

func TestServiceContextWrapper_StartService(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	targetHandler := &testAppHandler{
		result: &IntentResult{ResultCode: ResultOK},
	}
	app.RegisterService("com.r3e.services.target", targetHandler)

	senderCtx := app.CreateServiceContext("com.r3e.services.sender")

	intent := NewExplicitIntent("com.r3e.services.target")
	_, err := senderCtx.StartService(intent)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Source package should be set
	if intent.SourcePackage != "com.r3e.services.sender" {
		t.Errorf("expected source package 'com.r3e.services.sender', got '%s'", intent.SourcePackage)
	}
}

func TestServiceContextWrapper_SendBroadcast(t *testing.T) {
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	received := false
	receiver := &testAppReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			received = true
			if intent.SourcePackage != "com.r3e.services.sender" {
				t.Errorf("expected source package 'com.r3e.services.sender', got '%s'", intent.SourcePackage)
			}
		},
	}

	filter := NewIntentFilterWithAction("com.r3e.action.TEST")
	app.Router().RegisterReceiver("test-receiver", receiver, "com.r3e.test", filter)

	senderCtx := app.CreateServiceContext("com.r3e.services.sender")

	intent := NewIntent("com.r3e.action.TEST")
	err := senderCtx.SendBroadcast(intent)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	if !received {
		t.Error("expected receiver to receive broadcast")
	}
}

// Test helpers

type testAppHandler struct {
	result      *IntentResult
	err         error
	handleCount int
}

func (h *testAppHandler) HandleIntent(ctx context.Context, intent *Intent) (*IntentResult, error) {
	h.handleCount++
	if h.err != nil {
		return nil, h.err
	}
	if h.result != nil {
		return h.result, nil
	}
	return &IntentResult{ResultCode: ResultOK}, nil
}

type testAppReceiver struct {
	onReceive func(ctx ServiceContext, intent *Intent)
}

func (r *testAppReceiver) OnReceive(ctx ServiceContext, intent *Intent) {
	if r.onReceive != nil {
		r.onReceive(ctx, intent)
	}
}
