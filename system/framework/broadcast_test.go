package framework

import (
	"testing"
	"time"
)

func TestSystemBroadcastManager_Creation(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	if bm == nil {
		t.Fatal("expected broadcast manager, got nil")
	}

	if bm.IsBooted() {
		t.Error("should not be booted initially")
	}

	if bm.IsShutdown() {
		t.Error("should not be shutdown initially")
	}
}

func TestSystemBroadcastManager_OnBootCompleted(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	bootReceived := false
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionBootCompleted {
				bootReceived = true
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionBootCompleted)
	router.RegisterReceiver("boot-receiver", receiver, "com.r3e.test", filter)

	// Trigger boot
	errors := bm.OnBootCompleted()
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if !bootReceived {
		t.Error("expected boot completed broadcast to be received")
	}

	if !bm.IsBooted() {
		t.Error("should be booted after OnBootCompleted")
	}

	if bm.BootTime().IsZero() {
		t.Error("boot time should be set")
	}
}

func TestSystemBroadcastManager_OnBootCompleted_OnlyOnce(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	bootCount := 0
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionBootCompleted {
				bootCount++
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionBootCompleted)
	router.RegisterReceiver("boot-receiver", receiver, "com.r3e.test", filter)

	// Trigger boot multiple times
	bm.OnBootCompleted()
	bm.OnBootCompleted()
	bm.OnBootCompleted()

	if bootCount != 1 {
		t.Errorf("expected boot to be triggered once, got %d", bootCount)
	}
}

func TestSystemBroadcastManager_OnShutdown(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	shutdownReceived := false
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionShutdown {
				shutdownReceived = true
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionShutdown)
	router.RegisterReceiver("shutdown-receiver", receiver, "com.r3e.test", filter)

	// Trigger shutdown
	errors := bm.OnShutdown()
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if !shutdownReceived {
		t.Error("expected shutdown broadcast to be received")
	}

	if !bm.IsShutdown() {
		t.Error("should be shutdown after OnShutdown")
	}
}

func TestSystemBroadcastManager_OnShutdown_OnlyOnce(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	shutdownCount := 0
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionShutdown {
				shutdownCount++
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionShutdown)
	router.RegisterReceiver("shutdown-receiver", receiver, "com.r3e.test", filter)

	// Trigger shutdown multiple times
	bm.OnShutdown()
	bm.OnShutdown()
	bm.OnShutdown()

	if shutdownCount != 1 {
		t.Errorf("expected shutdown to be triggered once, got %d", shutdownCount)
	}
}

func TestSystemBroadcastManager_OnPackageAdded(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	var receivedIntent *Intent
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionPackageAdded {
				receivedIntent = intent
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionPackageAdded)
	router.RegisterReceiver("package-receiver", receiver, "com.r3e.test", filter)

	// Trigger package added
	errors := bm.OnPackageAdded("com.r3e.services.new", "1.0.0")
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if receivedIntent == nil {
		t.Fatal("expected package added broadcast to be received")
	}

	if receivedIntent.GetStringExtra("package_name") != "com.r3e.services.new" {
		t.Errorf("expected package_name 'com.r3e.services.new', got '%s'", receivedIntent.GetStringExtra("package_name"))
	}

	if receivedIntent.GetStringExtra("version") != "1.0.0" {
		t.Errorf("expected version '1.0.0', got '%s'", receivedIntent.GetStringExtra("version"))
	}

	if receivedIntent.Data != "package://com.r3e.services.new" {
		t.Errorf("expected data 'package://com.r3e.services.new', got '%s'", receivedIntent.Data)
	}
}

func TestSystemBroadcastManager_OnPackageRemoved(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	var receivedIntent *Intent
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionPackageRemoved {
				receivedIntent = intent
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionPackageRemoved)
	router.RegisterReceiver("package-receiver", receiver, "com.r3e.test", filter)

	// Trigger package removed
	errors := bm.OnPackageRemoved("com.r3e.services.old")
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if receivedIntent == nil {
		t.Fatal("expected package removed broadcast to be received")
	}

	if receivedIntent.GetStringExtra("package_name") != "com.r3e.services.old" {
		t.Errorf("expected package_name 'com.r3e.services.old', got '%s'", receivedIntent.GetStringExtra("package_name"))
	}
}

func TestSystemBroadcastManager_OnPackageReplaced(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	var receivedIntent *Intent
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionPackageReplaced {
				receivedIntent = intent
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionPackageReplaced)
	router.RegisterReceiver("package-receiver", receiver, "com.r3e.test", filter)

	// Trigger package replaced
	errors := bm.OnPackageReplaced("com.r3e.services.updated", "1.0.0", "2.0.0")
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if receivedIntent == nil {
		t.Fatal("expected package replaced broadcast to be received")
	}

	if receivedIntent.GetStringExtra("old_version") != "1.0.0" {
		t.Errorf("expected old_version '1.0.0', got '%s'", receivedIntent.GetStringExtra("old_version"))
	}

	if receivedIntent.GetStringExtra("new_version") != "2.0.0" {
		t.Errorf("expected new_version '2.0.0', got '%s'", receivedIntent.GetStringExtra("new_version"))
	}
}

func TestSystemBroadcastManager_OnConfigurationChanged(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	var receivedIntent *Intent
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionConfigurationChanged {
				receivedIntent = intent
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionConfigurationChanged)
	router.RegisterReceiver("config-receiver", receiver, "com.r3e.test", filter)

	// Trigger configuration changed
	changes := map[string]any{
		"debug":   true,
		"timeout": 30,
	}
	errors := bm.OnConfigurationChanged(changes)
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if receivedIntent == nil {
		t.Fatal("expected configuration changed broadcast to be received")
	}

	if receivedIntent.GetBoolExtra("debug", false) != true {
		t.Error("expected debug to be true")
	}

	if receivedIntent.GetIntExtra("timeout", 0) != 30 {
		t.Errorf("expected timeout 30, got %d", receivedIntent.GetIntExtra("timeout", 0))
	}
}

func TestSystemBroadcastManager_OnHealthCheck(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	healthCheckReceived := false
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			if intent.Action == ActionHealthCheck {
				healthCheckReceived = true
			}
		},
	}

	filter := NewIntentFilterWithAction(ActionHealthCheck)
	router.RegisterReceiver("health-receiver", receiver, "com.r3e.test", filter)

	// Trigger health check
	errors := bm.OnHealthCheck()
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if !healthCheckReceived {
		t.Error("expected health check broadcast to be received")
	}
}

func TestSystemBroadcastManager_SendCustomBroadcast(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	var receivedIntent *Intent
	receiver := &testBroadcastReceiver{
		onReceive: func(ctx ServiceContext, intent *Intent) {
			receivedIntent = intent
		},
	}

	filter := NewIntentFilterWithAction("com.r3e.action.CUSTOM")
	router.RegisterReceiver("custom-receiver", receiver, "com.r3e.test", filter)

	// Send custom broadcast
	extras := map[string]any{
		"key1": "value1",
		"key2": 42,
	}
	errors := bm.SendCustomBroadcast("com.r3e.action.CUSTOM", extras)
	if len(errors) > 0 {
		t.Errorf("unexpected errors: %v", errors)
	}

	if receivedIntent == nil {
		t.Fatal("expected custom broadcast to be received")
	}

	if receivedIntent.Action != "com.r3e.action.CUSTOM" {
		t.Errorf("expected action 'com.r3e.action.CUSTOM', got '%s'", receivedIntent.Action)
	}

	if receivedIntent.GetStringExtra("key1") != "value1" {
		t.Errorf("expected key1 'value1', got '%s'", receivedIntent.GetStringExtra("key1"))
	}
}

func TestSystemBroadcastManager_Uptime(t *testing.T) {
	router := NewIntentRouter()
	app := NewApplicationContext(ApplicationConfig{
		AppName:     "Test",
		PackageName: "com.r3e.test",
	})

	bm := NewSystemBroadcastManager(router, app)

	// Before boot, uptime should be 0
	if bm.Uptime() != 0 {
		t.Error("uptime should be 0 before boot")
	}

	// Boot the system
	bm.OnBootCompleted()

	// Wait a bit
	time.Sleep(50 * time.Millisecond)

	// Uptime should be > 0
	if bm.Uptime() <= 0 {
		t.Error("uptime should be > 0 after boot")
	}
}

// Test helper
type testBroadcastReceiver struct {
	onReceive func(ctx ServiceContext, intent *Intent)
}

func (r *testBroadcastReceiver) OnReceive(ctx ServiceContext, intent *Intent) {
	if r.onReceive != nil {
		r.onReceive(ctx, intent)
	}
}
