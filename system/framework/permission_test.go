package framework

import (
	"context"
	"testing"
	"time"
)

func TestPermissionManager_Creation(t *testing.T) {
	pm := NewPermissionManager()

	if pm == nil {
		t.Fatal("expected permission manager, got nil")
	}

	// Should have standard permissions registered
	perms := pm.GetAllPermissions()
	if len(perms) == 0 {
		t.Error("expected standard permissions to be registered")
	}
}

func TestPermissionManager_StandardPermissions(t *testing.T) {
	pm := NewPermissionManager()

	// Check that all standard permissions are registered
	standardPerms := []string{
		PermissionReadAccounts,
		PermissionWriteAccounts,
		PermissionManageAccounts,
		PermissionDeleteAccounts,
		PermissionReadStorage,
		PermissionWriteStorage,
		PermissionDeleteStorage,
		PermissionInternet,
		PermissionNetworkState,
		PermissionAccessRPC,
		PermissionUseCrypto,
		PermissionManageKeys,
		PermissionSignData,
		PermissionEncryptData,
		PermissionExecuteFunctions,
		PermissionScheduleJobs,
		PermissionManageTriggers,
		PermissionPublishEvents,
		PermissionSubscribeEvents,
		PermissionPushData,
		PermissionInvokeCompute,
		PermissionAdmin,
		PermissionManageServices,
		PermissionViewMetrics,
		PermissionManageConfig,
		PermissionAccessOracle,
		PermissionAccessVRF,
		PermissionAccessDataFeeds,
		PermissionAccessGasBank,
		PermissionAccessSecrets,
		PermissionAccessCCIP,
	}

	for _, perm := range standardPerms {
		if pm.GetPermission(perm) == nil {
			t.Errorf("expected permission %s to be registered", perm)
		}
	}
}

func TestPermissionManager_GrantPermission(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Grant permission
	err := pm.GrantPermission(ctx, "com.r3e.services.test", PermissionReadAccounts, "system")
	if err != nil {
		t.Errorf("unexpected error granting permission: %v", err)
	}

	// Check permission
	result := pm.CheckPermission(ctx, "com.r3e.services.test", PermissionReadAccounts)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted, got %v", result)
	}
}

func TestPermissionManager_RevokePermission(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Grant then revoke
	pm.GrantPermission(ctx, "com.r3e.services.test", PermissionReadAccounts, "system")
	err := pm.RevokePermission(ctx, "com.r3e.services.test", PermissionReadAccounts, "system")
	if err != nil {
		t.Errorf("unexpected error revoking permission: %v", err)
	}

	// Check permission
	result := pm.CheckPermission(ctx, "com.r3e.services.test", PermissionReadAccounts)
	if result != PermissionDenied {
		t.Errorf("expected PermissionDenied after revoke, got %v", result)
	}
}

func TestPermissionManager_CheckPermissionDenied(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Check permission without granting
	result := pm.CheckPermission(ctx, "com.r3e.services.test", PermissionReadAccounts)
	if result != PermissionDenied {
		t.Errorf("expected PermissionDenied for ungranted permission, got %v", result)
	}
}

func TestPermissionManager_GrantUnknownPermission(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Try to grant unknown permission
	err := pm.GrantPermission(ctx, "com.r3e.services.test", "unknown.permission", "system")
	if err == nil {
		t.Error("expected error for unknown permission")
	}
}

func TestPermissionManager_GrantAllPermissions(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Grant all permissions (admin)
	err := pm.GrantAllPermissions(ctx, "com.r3e.services.system", "system")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Should have any permission now
	result := pm.CheckPermission(ctx, "com.r3e.services.system", PermissionReadAccounts)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted after granting all, got %v", result)
	}

	result = pm.CheckPermission(ctx, "com.r3e.services.system", PermissionAdmin)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted for admin, got %v", result)
	}
}

func TestPermissionManager_GrantGroupPermissions(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Grant all account permissions
	err := pm.GrantGroupPermissions(ctx, "com.r3e.services.test", PermissionGroupAccounts.Name, "system")
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Should have account permissions
	result := pm.CheckPermission(ctx, "com.r3e.services.test", PermissionReadAccounts)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted for READ_ACCOUNTS, got %v", result)
	}

	result = pm.CheckPermission(ctx, "com.r3e.services.test", PermissionWriteAccounts)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted for WRITE_ACCOUNTS, got %v", result)
	}

	// Should not have storage permissions
	result = pm.CheckPermission(ctx, "com.r3e.services.test", PermissionReadStorage)
	if result == PermissionGranted {
		t.Error("should not have storage permission")
	}
}

func TestPermissionManager_GrantWithExpiry(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Grant with short expiry
	expiry := time.Now().Add(50 * time.Millisecond)
	err := pm.GrantPermissionWithExpiry(ctx, "com.r3e.services.test", PermissionReadAccounts, "system", expiry)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Should have permission initially
	result := pm.CheckPermission(ctx, "com.r3e.services.test", PermissionReadAccounts)
	if result != PermissionGranted {
		t.Errorf("expected PermissionGranted initially, got %v", result)
	}

	// Wait for expiry
	time.Sleep(100 * time.Millisecond)

	// Should be denied after expiry
	result = pm.CheckPermission(ctx, "com.r3e.services.test", PermissionReadAccounts)
	if result != PermissionDenied {
		t.Errorf("expected PermissionDenied after expiry, got %v", result)
	}
}

func TestPermissionManager_GetPackagePermissions(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Grant multiple permissions
	pm.GrantPermission(ctx, "com.r3e.services.test", PermissionReadAccounts, "system")
	pm.GrantPermission(ctx, "com.r3e.services.test", PermissionWriteAccounts, "system")

	// Get package permissions
	grants := pm.GetPackagePermissions("com.r3e.services.test")
	if len(grants) != 2 {
		t.Errorf("expected 2 grants, got %d", len(grants))
	}
}

func TestPermissionManager_AuditLog(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	// Perform some operations
	pm.GrantPermission(ctx, "com.r3e.services.test", PermissionReadAccounts, "system")
	pm.RevokePermission(ctx, "com.r3e.services.test", PermissionReadAccounts, "system")

	// Get audit log
	log := pm.GetAuditLog(10)
	if len(log) < 2 {
		t.Errorf("expected at least 2 audit entries, got %d", len(log))
	}
}

func TestPermissionManager_AuditCallback(t *testing.T) {
	pm := NewPermissionManager()
	ctx := context.Background()

	callbackCalled := false
	pm.SetAuditCallback(func(entry PermissionAuditEntry) {
		callbackCalled = true
	})

	pm.GrantPermission(ctx, "com.r3e.services.test", PermissionReadAccounts, "system")

	// Wait for async callback
	time.Sleep(50 * time.Millisecond)

	if !callbackCalled {
		t.Error("expected audit callback to be called")
	}
}

func TestProtectionLevel_String(t *testing.T) {
	tests := []struct {
		level    ProtectionLevel
		expected string
	}{
		{ProtectionNormal, "normal"},
		{ProtectionDangerous, "dangerous"},
		{ProtectionSignature, "signature"},
		{ProtectionSignatureOrSystem, "signatureOrSystem"},
		{ProtectionInternal, "internal"},
		{ProtectionLevel(99), "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			if tt.level.String() != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, tt.level.String())
			}
		})
	}
}

func TestPermissionGrant_IsExpired(t *testing.T) {
	// Not expired (zero time)
	grant := &PermissionGrant{
		Permission: PermissionReadAccounts,
		GrantedAt:  time.Now(),
	}
	if grant.IsExpired() {
		t.Error("grant with zero expiry should not be expired")
	}

	// Not expired (future time)
	grant.ExpiresAt = time.Now().Add(time.Hour)
	if grant.IsExpired() {
		t.Error("grant with future expiry should not be expired")
	}

	// Expired (past time)
	grant.ExpiresAt = time.Now().Add(-time.Hour)
	if !grant.IsExpired() {
		t.Error("grant with past expiry should be expired")
	}
}

func TestPermissionResult_String(t *testing.T) {
	tests := []struct {
		result   PermissionResult
		expected string
	}{
		{PermissionGranted, "granted"},
		{PermissionDenied, "denied"},
		{PermissionUnknown, "unknown"},
		{PermissionResult(99), "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			if tt.result.String() != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, tt.result.String())
			}
		})
	}
}

func TestPermissionManager_GetPermission(t *testing.T) {
	pm := NewPermissionManager()

	// Get existing permission
	perm := pm.GetPermission(PermissionReadAccounts)
	if perm == nil {
		t.Error("expected permission, got nil")
	}
	if perm.Name != PermissionReadAccounts {
		t.Errorf("expected name %s, got %s", PermissionReadAccounts, perm.Name)
	}

	// Get non-existing permission
	perm = pm.GetPermission("non.existing.permission")
	if perm != nil {
		t.Error("expected nil for non-existing permission")
	}
}

func TestPermissionManager_GetGroup(t *testing.T) {
	pm := NewPermissionManager()

	// Get existing group
	group := pm.GetGroup(PermissionGroupAccounts.Name)
	if group == nil {
		t.Error("expected group, got nil")
	}
	if group.Name != PermissionGroupAccounts.Name {
		t.Errorf("expected name %s, got %s", PermissionGroupAccounts.Name, group.Name)
	}

	// Get non-existing group
	group = pm.GetGroup("non.existing.group")
	if group != nil {
		t.Error("expected nil for non-existing group")
	}
}
