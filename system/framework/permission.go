// Package framework provides the Permission system for Android-style access control.
// This implements fine-grained permission management with permission groups,
// runtime checks, and audit logging.
package framework

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Permission represents a single permission that can be granted or denied.
type Permission struct {
	// Name is the unique identifier for this permission (e.g., "com.r3e.permission.READ_ACCOUNTS").
	Name string

	// Group is the permission group this belongs to (e.g., "com.r3e.permission-group.ACCOUNTS").
	Group string

	// Description is a human-readable description of what this permission allows.
	Description string

	// ProtectionLevel indicates how dangerous this permission is.
	ProtectionLevel ProtectionLevel

	// Flags provide additional permission characteristics.
	Flags PermissionFlags
}

// ProtectionLevel indicates the risk level of a permission.
type ProtectionLevel int

const (
	// ProtectionNormal is for low-risk permissions that don't pose much risk.
	ProtectionNormal ProtectionLevel = iota
	// ProtectionDangerous is for permissions that could affect user privacy or device operation.
	ProtectionDangerous
	// ProtectionSignature is for permissions only granted to apps signed with the same certificate.
	ProtectionSignature
	// ProtectionSignatureOrSystem is for permissions granted to system apps or same-signature apps.
	ProtectionSignatureOrSystem
	// ProtectionInternal is for internal system permissions.
	ProtectionInternal
)

// String returns a human-readable protection level.
func (p ProtectionLevel) String() string {
	switch p {
	case ProtectionNormal:
		return "normal"
	case ProtectionDangerous:
		return "dangerous"
	case ProtectionSignature:
		return "signature"
	case ProtectionSignatureOrSystem:
		return "signatureOrSystem"
	case ProtectionInternal:
		return "internal"
	default:
		return "unknown"
	}
}

// PermissionFlags provide additional permission characteristics.
type PermissionFlags uint32

const (
	// FlagCostsMoney indicates the permission may result in charges.
	FlagCostsMoney PermissionFlags = 1 << iota
	// FlagRemoved indicates the permission has been removed.
	FlagRemoved
	// FlagInstalled indicates the permission is installed.
	FlagInstalled
	// FlagHardRestricted indicates the permission is hard restricted.
	FlagHardRestricted
	// FlagSoftRestricted indicates the permission is soft restricted.
	FlagSoftRestricted
	// FlagImmutablyRestricted indicates the permission restriction cannot be changed.
	FlagImmutablyRestricted
)

// PermissionGroup represents a group of related permissions.
type PermissionGroup struct {
	// Name is the unique identifier for this group.
	Name string

	// Description is a human-readable description of this group.
	Description string

	// Priority determines the order in which groups are displayed.
	Priority int
}

// Standard Permission Groups (similar to Android)
var (
	PermissionGroupAccounts = &PermissionGroup{
		Name:        "com.r3e.permission-group.ACCOUNTS",
		Description: "Access to account information",
		Priority:    100,
	}
	PermissionGroupStorage = &PermissionGroup{
		Name:        "com.r3e.permission-group.STORAGE",
		Description: "Access to storage operations",
		Priority:    90,
	}
	PermissionGroupNetwork = &PermissionGroup{
		Name:        "com.r3e.permission-group.NETWORK",
		Description: "Access to network operations",
		Priority:    80,
	}
	PermissionGroupCrypto = &PermissionGroup{
		Name:        "com.r3e.permission-group.CRYPTO",
		Description: "Access to cryptographic operations",
		Priority:    70,
	}
	PermissionGroupExecution = &PermissionGroup{
		Name:        "com.r3e.permission-group.EXECUTION",
		Description: "Access to execution operations",
		Priority:    60,
	}
	PermissionGroupAdmin = &PermissionGroup{
		Name:        "com.r3e.permission-group.ADMIN",
		Description: "Administrative operations",
		Priority:    50,
	}
)

// Standard Permissions
const (
	// Account permissions
	PermissionReadAccounts    = "com.r3e.permission.READ_ACCOUNTS"
	PermissionWriteAccounts   = "com.r3e.permission.WRITE_ACCOUNTS"
	PermissionManageAccounts  = "com.r3e.permission.MANAGE_ACCOUNTS"
	PermissionDeleteAccounts  = "com.r3e.permission.DELETE_ACCOUNTS"

	// Storage permissions
	PermissionReadStorage     = "com.r3e.permission.READ_STORAGE"
	PermissionWriteStorage    = "com.r3e.permission.WRITE_STORAGE"
	PermissionDeleteStorage   = "com.r3e.permission.DELETE_STORAGE"

	// Network permissions
	PermissionInternet        = "com.r3e.permission.INTERNET"
	PermissionNetworkState    = "com.r3e.permission.NETWORK_STATE"
	PermissionAccessRPC       = "com.r3e.permission.ACCESS_RPC"

	// Crypto permissions
	PermissionUseCrypto       = "com.r3e.permission.USE_CRYPTO"
	PermissionManageKeys      = "com.r3e.permission.MANAGE_KEYS"
	PermissionSignData        = "com.r3e.permission.SIGN_DATA"
	PermissionEncryptData     = "com.r3e.permission.ENCRYPT_DATA"

	// Execution permissions
	PermissionExecuteFunctions = "com.r3e.permission.EXECUTE_FUNCTIONS"
	PermissionScheduleJobs     = "com.r3e.permission.SCHEDULE_JOBS"
	PermissionManageTriggers   = "com.r3e.permission.MANAGE_TRIGGERS"

	// Bus permissions
	PermissionPublishEvents   = "com.r3e.permission.PUBLISH_EVENTS"
	PermissionSubscribeEvents = "com.r3e.permission.SUBSCRIBE_EVENTS"
	PermissionPushData        = "com.r3e.permission.PUSH_DATA"
	PermissionInvokeCompute   = "com.r3e.permission.INVOKE_COMPUTE"

	// Admin permissions
	PermissionAdmin           = "com.r3e.permission.ADMIN"
	PermissionManageServices  = "com.r3e.permission.MANAGE_SERVICES"
	PermissionViewMetrics     = "com.r3e.permission.VIEW_METRICS"
	PermissionManageConfig    = "com.r3e.permission.MANAGE_CONFIG"

	// Service-specific permissions
	PermissionAccessOracle    = "com.r3e.permission.ACCESS_ORACLE"
	PermissionAccessVRF       = "com.r3e.permission.ACCESS_VRF"
	PermissionAccessDataFeeds = "com.r3e.permission.ACCESS_DATAFEEDS"
	PermissionAccessGasBank   = "com.r3e.permission.ACCESS_GASBANK"
	PermissionAccessSecrets   = "com.r3e.permission.ACCESS_SECRETS"
	PermissionAccessCCIP      = "com.r3e.permission.ACCESS_CCIP"
)

// PermissionGrant represents a granted permission with metadata.
type PermissionGrant struct {
	// Permission is the permission name.
	Permission string

	// GrantedAt is when the permission was granted.
	GrantedAt time.Time

	// GrantedBy is who granted the permission.
	GrantedBy string

	// ExpiresAt is when the permission expires (zero means never).
	ExpiresAt time.Time

	// Flags are additional grant flags.
	Flags PermissionGrantFlags
}

// PermissionGrantFlags provide additional grant characteristics.
type PermissionGrantFlags uint32

const (
	// GrantFlagUserSet indicates the grant was set by the user.
	GrantFlagUserSet PermissionGrantFlags = 1 << iota
	// GrantFlagSystemFixed indicates the grant cannot be changed.
	GrantFlagSystemFixed
	// GrantFlagPolicy indicates the grant was set by policy.
	GrantFlagPolicy
	// GrantFlagOneTime indicates the grant is for one-time use.
	GrantFlagOneTime
)

// IsExpired checks if the grant has expired.
func (g *PermissionGrant) IsExpired() bool {
	if g.ExpiresAt.IsZero() {
		return false
	}
	return time.Now().After(g.ExpiresAt)
}

// PermissionAuditEntry represents an audit log entry for permission operations.
type PermissionAuditEntry struct {
	// Timestamp is when the operation occurred.
	Timestamp time.Time

	// Operation is the type of operation (grant, revoke, check).
	Operation string

	// Package is the package involved.
	Package string

	// Permission is the permission involved.
	Permission string

	// Result is the result of the operation.
	Result PermissionResult

	// GrantedBy is who performed the operation (for grant/revoke).
	GrantedBy string

	// Details contains additional operation details.
	Details map[string]any
}

// PermissionManager manages permissions for all packages.
type PermissionManager struct {
	// Registered permissions
	permissions map[string]*Permission

	// Permission groups
	groups map[string]*PermissionGroup

	// Grants per package: package -> permission -> grant
	grants map[string]map[string]*PermissionGrant

	// Audit log
	auditLog []PermissionAuditEntry

	// Maximum audit log size
	maxAuditSize int

	// Audit callback
	auditCallback func(entry PermissionAuditEntry)

	mu sync.RWMutex
}

// NewPermissionManager creates a new PermissionManager.
func NewPermissionManager() *PermissionManager {
	pm := &PermissionManager{
		permissions:  make(map[string]*Permission),
		groups:       make(map[string]*PermissionGroup),
		grants:       make(map[string]map[string]*PermissionGrant),
		auditLog:     make([]PermissionAuditEntry, 0, 1000),
		maxAuditSize: 10000,
	}
	pm.registerStandardPermissions()
	return pm
}

// registerStandardPermissions registers all standard permissions.
func (pm *PermissionManager) registerStandardPermissions() {
	// Register groups
	pm.RegisterGroup(PermissionGroupAccounts)
	pm.RegisterGroup(PermissionGroupStorage)
	pm.RegisterGroup(PermissionGroupNetwork)
	pm.RegisterGroup(PermissionGroupCrypto)
	pm.RegisterGroup(PermissionGroupExecution)
	pm.RegisterGroup(PermissionGroupAdmin)

	// Register account permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionReadAccounts,
		Group:           PermissionGroupAccounts.Name,
		Description:     "Read account information",
		ProtectionLevel: ProtectionNormal,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionWriteAccounts,
		Group:           PermissionGroupAccounts.Name,
		Description:     "Create and modify accounts",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionManageAccounts,
		Group:           PermissionGroupAccounts.Name,
		Description:     "Full account management",
		ProtectionLevel: ProtectionSignature,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionDeleteAccounts,
		Group:           PermissionGroupAccounts.Name,
		Description:     "Delete accounts",
		ProtectionLevel: ProtectionSignature,
	})

	// Register storage permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionReadStorage,
		Group:           PermissionGroupStorage.Name,
		Description:     "Read from storage",
		ProtectionLevel: ProtectionNormal,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionWriteStorage,
		Group:           PermissionGroupStorage.Name,
		Description:     "Write to storage",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionDeleteStorage,
		Group:           PermissionGroupStorage.Name,
		Description:     "Delete from storage",
		ProtectionLevel: ProtectionDangerous,
	})

	// Register network permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionInternet,
		Group:           PermissionGroupNetwork.Name,
		Description:     "Access the internet",
		ProtectionLevel: ProtectionNormal,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionAccessRPC,
		Group:           PermissionGroupNetwork.Name,
		Description:     "Access RPC endpoints",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionNetworkState,
		Group:           PermissionGroupNetwork.Name,
		Description:     "Access network state information",
		ProtectionLevel: ProtectionNormal,
	})

	// Register crypto permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionUseCrypto,
		Group:           PermissionGroupCrypto.Name,
		Description:     "Use cryptographic operations",
		ProtectionLevel: ProtectionNormal,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionManageKeys,
		Group:           PermissionGroupCrypto.Name,
		Description:     "Manage cryptographic keys",
		ProtectionLevel: ProtectionSignature,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionSignData,
		Group:           PermissionGroupCrypto.Name,
		Description:     "Sign data with keys",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionEncryptData,
		Group:           PermissionGroupCrypto.Name,
		Description:     "Encrypt and decrypt data",
		ProtectionLevel: ProtectionDangerous,
	})

	// Register execution permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionExecuteFunctions,
		Group:           PermissionGroupExecution.Name,
		Description:     "Execute functions",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionScheduleJobs,
		Group:           PermissionGroupExecution.Name,
		Description:     "Schedule automation jobs",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionManageTriggers,
		Group:           PermissionGroupExecution.Name,
		Description:     "Manage automation triggers",
		ProtectionLevel: ProtectionDangerous,
	})

	// Register bus permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionPublishEvents,
		Group:           PermissionGroupNetwork.Name,
		Description:     "Publish events to the bus",
		ProtectionLevel: ProtectionNormal,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionSubscribeEvents,
		Group:           PermissionGroupNetwork.Name,
		Description:     "Subscribe to events from the bus",
		ProtectionLevel: ProtectionNormal,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionPushData,
		Group:           PermissionGroupNetwork.Name,
		Description:     "Push data to the bus",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionInvokeCompute,
		Group:           PermissionGroupExecution.Name,
		Description:     "Invoke compute operations",
		ProtectionLevel: ProtectionDangerous,
	})

	// Register admin permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionAdmin,
		Group:           PermissionGroupAdmin.Name,
		Description:     "Full administrative access",
		ProtectionLevel: ProtectionSignature,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionManageServices,
		Group:           PermissionGroupAdmin.Name,
		Description:     "Manage service lifecycle",
		ProtectionLevel: ProtectionSignature,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionViewMetrics,
		Group:           PermissionGroupAdmin.Name,
		Description:     "View system metrics",
		ProtectionLevel: ProtectionNormal,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionManageConfig,
		Group:           PermissionGroupAdmin.Name,
		Description:     "Manage system configuration",
		ProtectionLevel: ProtectionSignature,
	})

	// Register service-specific permissions
	pm.RegisterPermission(&Permission{
		Name:            PermissionAccessOracle,
		Group:           PermissionGroupExecution.Name,
		Description:     "Access oracle service",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionAccessVRF,
		Group:           PermissionGroupExecution.Name,
		Description:     "Access VRF service",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionAccessDataFeeds,
		Group:           PermissionGroupExecution.Name,
		Description:     "Access data feeds service",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionAccessGasBank,
		Group:           PermissionGroupExecution.Name,
		Description:     "Access gas bank service",
		ProtectionLevel: ProtectionDangerous,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionAccessSecrets,
		Group:           PermissionGroupCrypto.Name,
		Description:     "Access secrets vault",
		ProtectionLevel: ProtectionSignature,
	})
	pm.RegisterPermission(&Permission{
		Name:            PermissionAccessCCIP,
		Group:           PermissionGroupNetwork.Name,
		Description:     "Access cross-chain interoperability",
		ProtectionLevel: ProtectionDangerous,
	})
}

// RegisterPermission registers a new permission.
func (pm *PermissionManager) RegisterPermission(perm *Permission) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.permissions[perm.Name] = perm
}

// RegisterGroup registers a new permission group.
func (pm *PermissionManager) RegisterGroup(group *PermissionGroup) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.groups[group.Name] = group
}

// GetPermission returns a permission by name.
func (pm *PermissionManager) GetPermission(name string) *Permission {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.permissions[name]
}

// GetGroup returns a permission group by name.
func (pm *PermissionManager) GetGroup(name string) *PermissionGroup {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.groups[name]
}

// GrantPermission grants a permission to a package.
func (pm *PermissionManager) GrantPermission(ctx context.Context, pkg, permission, grantedBy string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Check if permission exists
	if _, ok := pm.permissions[permission]; !ok {
		return fmt.Errorf("unknown permission: %s", permission)
	}

	// Initialize package grants if needed
	if pm.grants[pkg] == nil {
		pm.grants[pkg] = make(map[string]*PermissionGrant)
	}

	// Create grant
	grant := &PermissionGrant{
		Permission: permission,
		GrantedAt:  time.Now(),
		GrantedBy:  grantedBy,
	}
	pm.grants[pkg][permission] = grant

	// Audit
	pm.audit(PermissionAuditEntry{
		Timestamp:  time.Now(),
		Operation:  "grant",
		Package:    pkg,
		Permission: permission,
		Result:     PermissionGranted,
		GrantedBy:  grantedBy,
	})

	return nil
}

// GrantPermissionWithExpiry grants a permission with an expiration time.
func (pm *PermissionManager) GrantPermissionWithExpiry(ctx context.Context, pkg, permission, grantedBy string, expiresAt time.Time) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if _, ok := pm.permissions[permission]; !ok {
		return fmt.Errorf("unknown permission: %s", permission)
	}

	if pm.grants[pkg] == nil {
		pm.grants[pkg] = make(map[string]*PermissionGrant)
	}

	grant := &PermissionGrant{
		Permission: permission,
		GrantedAt:  time.Now(),
		GrantedBy:  grantedBy,
		ExpiresAt:  expiresAt,
	}
	pm.grants[pkg][permission] = grant

	pm.audit(PermissionAuditEntry{
		Timestamp:  time.Now(),
		Operation:  "grant_with_expiry",
		Package:    pkg,
		Permission: permission,
		Result:     PermissionGranted,
		GrantedBy:  grantedBy,
		Details:    map[string]any{"expires_at": expiresAt},
	})

	return nil
}

// RevokePermission revokes a permission from a package.
func (pm *PermissionManager) RevokePermission(ctx context.Context, pkg, permission, revokedBy string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.grants[pkg] != nil {
		delete(pm.grants[pkg], permission)
	}

	pm.audit(PermissionAuditEntry{
		Timestamp:  time.Now(),
		Operation:  "revoke",
		Package:    pkg,
		Permission: permission,
		Result:     PermissionDenied,
		GrantedBy:  revokedBy,
	})

	return nil
}

// CheckPermission checks if a package has a permission.
func (pm *PermissionManager) CheckPermission(ctx context.Context, pkg, permission string) PermissionResult {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := PermissionDenied

	if grants, ok := pm.grants[pkg]; ok {
		if grant, ok := grants[permission]; ok {
			if !grant.IsExpired() {
				result = PermissionGranted
			}
		}
	}

	// Check for wildcard permissions
	if result == PermissionDenied {
		result = pm.checkWildcardPermission(pkg, permission)
	}

	// Audit the check
	go pm.auditAsync(PermissionAuditEntry{
		Timestamp:  time.Now(),
		Operation:  "check",
		Package:    pkg,
		Permission: permission,
		Result:     result,
	})

	return result
}

// checkWildcardPermission checks for wildcard permission grants.
func (pm *PermissionManager) checkWildcardPermission(pkg, permission string) PermissionResult {
	grants, ok := pm.grants[pkg]
	if !ok {
		return PermissionDenied
	}

	// Check for admin permission (grants all)
	if grant, ok := grants[PermissionAdmin]; ok && !grant.IsExpired() {
		return PermissionGranted
	}

	// Check for group-level permission
	if perm, ok := pm.permissions[permission]; ok && perm.Group != "" {
		groupPerm := perm.Group + ".*"
		if grant, ok := grants[groupPerm]; ok && !grant.IsExpired() {
			return PermissionGranted
		}
	}

	// Check for prefix wildcard (e.g., "com.r3e.permission.READ_*")
	for grantedPerm, grant := range grants {
		if grant.IsExpired() {
			continue
		}
		if strings.HasSuffix(grantedPerm, "*") {
			prefix := grantedPerm[:len(grantedPerm)-1]
			if strings.HasPrefix(permission, prefix) {
				return PermissionGranted
			}
		}
	}

	return PermissionDenied
}

// GetPackagePermissions returns all permissions granted to a package.
func (pm *PermissionManager) GetPackagePermissions(pkg string) []*PermissionGrant {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var result []*PermissionGrant
	if grants, ok := pm.grants[pkg]; ok {
		for _, grant := range grants {
			if !grant.IsExpired() {
				result = append(result, grant)
			}
		}
	}
	return result
}

// GetAllPermissions returns all registered permissions.
func (pm *PermissionManager) GetAllPermissions() []*Permission {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]*Permission, 0, len(pm.permissions))
	for _, perm := range pm.permissions {
		result = append(result, perm)
	}
	return result
}

// GetAuditLog returns the audit log entries.
func (pm *PermissionManager) GetAuditLog(limit int) []PermissionAuditEntry {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	if limit <= 0 || limit > len(pm.auditLog) {
		limit = len(pm.auditLog)
	}

	// Return most recent entries
	start := len(pm.auditLog) - limit
	if start < 0 {
		start = 0
	}

	result := make([]PermissionAuditEntry, limit)
	copy(result, pm.auditLog[start:])
	return result
}

// SetAuditCallback sets a callback for audit events.
func (pm *PermissionManager) SetAuditCallback(callback func(entry PermissionAuditEntry)) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.auditCallback = callback
}

// audit adds an entry to the audit log.
func (pm *PermissionManager) audit(entry PermissionAuditEntry) {
	// Trim log if too large
	if len(pm.auditLog) >= pm.maxAuditSize {
		pm.auditLog = pm.auditLog[pm.maxAuditSize/2:]
	}
	pm.auditLog = append(pm.auditLog, entry)

	// Call callback if set
	if pm.auditCallback != nil {
		go pm.auditCallback(entry)
	}
}

// auditAsync adds an audit entry asynchronously.
func (pm *PermissionManager) auditAsync(entry PermissionAuditEntry) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.audit(entry)
}

// GrantAllPermissions grants all permissions to a package (for system services).
func (pm *PermissionManager) GrantAllPermissions(ctx context.Context, pkg, grantedBy string) error {
	return pm.GrantPermission(ctx, pkg, PermissionAdmin, grantedBy)
}

// GrantGroupPermissions grants all permissions in a group to a package.
func (pm *PermissionManager) GrantGroupPermissions(ctx context.Context, pkg, group, grantedBy string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.grants[pkg] == nil {
		pm.grants[pkg] = make(map[string]*PermissionGrant)
	}

	for _, perm := range pm.permissions {
		if perm.Group == group {
			grant := &PermissionGrant{
				Permission: perm.Name,
				GrantedAt:  time.Now(),
				GrantedBy:  grantedBy,
			}
			pm.grants[pkg][perm.Name] = grant
		}
	}

	pm.audit(PermissionAuditEntry{
		Timestamp:  time.Now(),
		Operation:  "grant_group",
		Package:    pkg,
		Permission: group,
		Result:     PermissionGranted,
		GrantedBy:  grantedBy,
	})

	return nil
}
