package storage

import (
	"context"

	"github.com/R3E-Network/service_layer/internal/domain/admin"
)

// AdminConfigStore persists admin configuration data.
type AdminConfigStore interface {
	// Chain RPC endpoints
	CreateChainRPC(ctx context.Context, rpc admin.ChainRPC) (admin.ChainRPC, error)
	UpdateChainRPC(ctx context.Context, rpc admin.ChainRPC) (admin.ChainRPC, error)
	GetChainRPC(ctx context.Context, id string) (admin.ChainRPC, error)
	GetChainRPCByChainID(ctx context.Context, chainID string) ([]admin.ChainRPC, error)
	ListChainRPCs(ctx context.Context) ([]admin.ChainRPC, error)
	DeleteChainRPC(ctx context.Context, id string) error

	// Data providers
	CreateDataProvider(ctx context.Context, provider admin.DataProvider) (admin.DataProvider, error)
	UpdateDataProvider(ctx context.Context, provider admin.DataProvider) (admin.DataProvider, error)
	GetDataProvider(ctx context.Context, id string) (admin.DataProvider, error)
	ListDataProviders(ctx context.Context) ([]admin.DataProvider, error)
	ListDataProvidersByType(ctx context.Context, providerType string) ([]admin.DataProvider, error)
	DeleteDataProvider(ctx context.Context, id string) error

	// System settings
	GetSetting(ctx context.Context, key string) (admin.SystemSetting, error)
	SetSetting(ctx context.Context, setting admin.SystemSetting) error
	ListSettings(ctx context.Context, category string) ([]admin.SystemSetting, error)
	DeleteSetting(ctx context.Context, key string) error

	// Feature flags
	GetFeatureFlag(ctx context.Context, key string) (admin.FeatureFlag, error)
	SetFeatureFlag(ctx context.Context, flag admin.FeatureFlag) error
	ListFeatureFlags(ctx context.Context) ([]admin.FeatureFlag, error)

	// Tenant quotas
	GetTenantQuota(ctx context.Context, tenantID string) (admin.TenantQuota, error)
	SetTenantQuota(ctx context.Context, quota admin.TenantQuota) error
	ListTenantQuotas(ctx context.Context) ([]admin.TenantQuota, error)
	DeleteTenantQuota(ctx context.Context, tenantID string) error

	// Allowed methods per chain
	GetAllowedMethods(ctx context.Context, chainID string) (admin.AllowedMethod, error)
	SetAllowedMethods(ctx context.Context, methods admin.AllowedMethod) error
	ListAllowedMethods(ctx context.Context) ([]admin.AllowedMethod, error)
}
