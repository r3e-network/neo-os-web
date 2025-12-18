package supabase

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/database"
	"github.com/R3E-Network/service_layer/infrastructure/globalsigner/types"
)

const (
	keyRotationsTable         = "signer_key_rotations"
	attestationArtifactsTable = "attestation_artifacts"
)

// =============================================================================
// Repository Interface
// =============================================================================

// Repository defines the interface for GlobalSigner data operations.
type Repository interface {
	// Key version operations
	CreateKeyVersion(ctx context.Context, v *types.KeyVersion) error
	UpdateKeyStatus(ctx context.Context, version string, status types.KeyStatus, overlapEndsAt *time.Time) error
	GetKeyVersion(ctx context.Context, version string) (*types.KeyVersion, error)
	ListKeyVersions(ctx context.Context, statuses []types.KeyStatus) ([]*types.KeyVersion, error)

	// Attestation operations
	StoreAttestation(ctx context.Context, keyVersion string, att *types.MasterKeyAttestation) error
	GetAttestation(ctx context.Context, keyVersion string) (*types.MasterKeyAttestation, error)
}

// =============================================================================
// Supabase Repository Implementation
// =============================================================================

// repository implements Repository using Supabase PostgREST.
type repository struct {
	base *database.Repository
}

// NewRepository creates a new Supabase repository.
func NewRepository(base *database.Repository) Repository {
	return &repository{base: base}
}

type keyRotationRow struct {
	ID              int64      `json:"id"`
	KeyID           string     `json:"key_id"`
	PublicKey       string     `json:"public_key"`
	AttestationHash string     `json:"attestation_hash"`
	Status          string     `json:"status"`
	RegistryTxHash  string     `json:"registry_tx_hash,omitempty"`
	ActivatedAt     *time.Time `json:"activated_at,omitempty"`
	OverlapEndsAt   *time.Time `json:"overlap_ends_at,omitempty"`
	RevokedAt       *time.Time `json:"revoked_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

func (r *repository) CreateKeyVersion(ctx context.Context, v *types.KeyVersion) error {
	if r == nil || r.base == nil {
		return fmt.Errorf("globalsigner: database not configured")
	}
	if v == nil {
		return fmt.Errorf("key version is required")
	}
	if strings.TrimSpace(v.Version) == "" {
		return fmt.Errorf("version is required")
	}
	if strings.TrimSpace(v.PubKeyHex) == "" {
		return fmt.Errorf("pubkey_hex is required")
	}
	if strings.TrimSpace(v.PubKeyHash) == "" {
		return fmt.Errorf("pubkey_hash is required")
	}

	payload := map[string]any{
		"key_id":           strings.TrimSpace(v.Version),
		"public_key":       strings.TrimSpace(v.PubKeyHex),
		"attestation_hash": strings.TrimSpace(v.PubKeyHash),
		"status":           string(v.Status),
		"registry_tx_hash": strings.TrimSpace(v.OnChainTxHash),
		"activated_at":     v.ActivatedAt,
		"overlap_ends_at":  v.OverlapEndsAt,
		"revoked_at":       v.RevokedAt,
		"created_at":       v.CreatedAt,
	}

	_, err := r.base.Request(ctx, "POST", keyRotationsTable, payload, "")
	if err != nil {
		return fmt.Errorf("create %s: %w", keyRotationsTable, err)
	}
	return nil
}

func (r *repository) UpdateKeyStatus(ctx context.Context, version string, status types.KeyStatus, overlapEndsAt *time.Time) error {
	if r == nil || r.base == nil {
		return fmt.Errorf("globalsigner: database not configured")
	}
	version = strings.TrimSpace(version)
	if version == "" {
		return fmt.Errorf("version is required")
	}

	update := map[string]any{
		"status":          string(status),
		"overlap_ends_at": overlapEndsAt,
	}
	if status == types.KeyStatusRevoked {
		now := time.Now().UTC()
		update["revoked_at"] = &now
	}

	query := "key_id=eq." + url.QueryEscape(version)
	_, err := r.base.Request(ctx, "PATCH", keyRotationsTable, update, query)
	if err != nil {
		return fmt.Errorf("update %s: %w", keyRotationsTable, err)
	}
	return nil
}

func (r *repository) GetKeyVersion(ctx context.Context, version string) (*types.KeyVersion, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("globalsigner: database not configured")
	}
	version = strings.TrimSpace(version)
	if version == "" {
		return nil, fmt.Errorf("version is required")
	}

	query := "key_id=eq." + url.QueryEscape(version) + "&limit=1"
	data, err := r.base.Request(ctx, "GET", keyRotationsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", keyRotationsTable, err)
	}

	var rows []keyRotationRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", keyRotationsTable, err)
	}
	if len(rows) == 0 {
		return nil, database.NewNotFoundError(keyRotationsTable, version)
	}

	row := &rows[0]
	return &types.KeyVersion{
		Version:       row.KeyID,
		Status:        types.KeyStatus(row.Status),
		PubKeyHex:     row.PublicKey,
		PubKeyHash:    row.AttestationHash,
		CreatedAt:     row.CreatedAt,
		ActivatedAt:   row.ActivatedAt,
		OverlapEndsAt: row.OverlapEndsAt,
		RevokedAt:     row.RevokedAt,
		OnChainTxHash: row.RegistryTxHash,
	}, nil
}

func (r *repository) ListKeyVersions(ctx context.Context, statuses []types.KeyStatus) ([]*types.KeyVersion, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("globalsigner: database not configured")
	}

	query := "order=created_at.desc"
	if len(statuses) > 0 {
		values := make([]string, 0, len(statuses))
		for _, st := range statuses {
			values = append(values, string(st))
		}
		query = "status=in.(" + strings.Join(values, ",") + ")&" + query
	}

	data, err := r.base.Request(ctx, "GET", keyRotationsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", keyRotationsTable, err)
	}

	var rows []keyRotationRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", keyRotationsTable, err)
	}

	out := make([]*types.KeyVersion, 0, len(rows))
	for i := range rows {
		row := &rows[i]
		out = append(out, &types.KeyVersion{
			Version:       row.KeyID,
			Status:        types.KeyStatus(row.Status),
			PubKeyHex:     row.PublicKey,
			PubKeyHash:    row.AttestationHash,
			CreatedAt:     row.CreatedAt,
			ActivatedAt:   row.ActivatedAt,
			OverlapEndsAt: row.OverlapEndsAt,
			RevokedAt:     row.RevokedAt,
			OnChainTxHash: row.RegistryTxHash,
		})
	}
	return out, nil
}

type attestationArtifactRow struct {
	ID           int64          `json:"id"`
	ServiceName  string         `json:"service_name"`
	ArtifactType string         `json:"artifact_type"`
	ArtifactHash string         `json:"artifact_hash"`
	ArtifactData []byte         `json:"artifact_data"`
	PublicKey    string         `json:"public_key,omitempty"`
	KeyID        string         `json:"key_id,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	VerifiedAt   *time.Time     `json:"verified_at,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
}

func (r *repository) StoreAttestation(ctx context.Context, keyVersion string, att *types.MasterKeyAttestation) error {
	if r == nil || r.base == nil {
		return fmt.Errorf("globalsigner: database not configured")
	}
	keyVersion = strings.TrimSpace(keyVersion)
	if keyVersion == "" {
		return fmt.Errorf("key_version is required")
	}
	if att == nil {
		return fmt.Errorf("attestation is required")
	}

	raw, err := json.Marshal(att)
	if err != nil {
		return fmt.Errorf("marshal attestation: %w", err)
	}

	sum := sha256.Sum256(raw)
	hashHex := hex.EncodeToString(sum[:])

	payload := map[string]any{
		"service_name":  types.ServiceID,
		"artifact_type": "quote",
		"artifact_hash": hashHex,
		"artifact_data": raw,
		"public_key":    strings.TrimSpace(att.PubKeyHex),
		"key_id":        keyVersion,
		"metadata": map[string]any{
			"pubkey_hash": strings.TrimSpace(att.PubKeyHash),
			"simulated":   att.Simulated,
		},
	}

	_, err = r.base.Request(ctx, "POST", attestationArtifactsTable, payload, "")
	if err != nil {
		return fmt.Errorf("create %s: %w", attestationArtifactsTable, err)
	}
	return nil
}

func (r *repository) GetAttestation(ctx context.Context, keyVersion string) (*types.MasterKeyAttestation, error) {
	if r == nil || r.base == nil {
		return nil, fmt.Errorf("globalsigner: database not configured")
	}
	keyVersion = strings.TrimSpace(keyVersion)
	if keyVersion == "" {
		return nil, fmt.Errorf("key_version is required")
	}

	query := database.NewQuery().
		Eq("service_name", types.ServiceID).
		Eq("key_id", keyVersion).
		Eq("artifact_type", "quote").
		OrderDesc("created_at").
		Limit(1).
		Build()

	data, err := r.base.Request(ctx, "GET", attestationArtifactsTable, nil, query)
	if err != nil {
		return nil, fmt.Errorf("get %s: %w", attestationArtifactsTable, err)
	}

	var rows []attestationArtifactRow
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("unmarshal %s: %w", attestationArtifactsTable, err)
	}
	if len(rows) == 0 {
		return nil, database.NewNotFoundError(attestationArtifactsTable, keyVersion)
	}

	var att types.MasterKeyAttestation
	if err := json.Unmarshal(rows[0].ArtifactData, &att); err != nil {
		return nil, fmt.Errorf("decode attestation: %w", err)
	}
	return &att, nil
}

// =============================================================================
// Mock Repository for Testing
// =============================================================================

// MockRepository is a mock implementation for testing.
type MockRepository struct {
	mu           sync.RWMutex
	keyVersions  map[string]*types.KeyVersion
	attestations map[string]*types.MasterKeyAttestation
}

// NewMockRepository creates a new mock repository.
func NewMockRepository() *MockRepository {
	return &MockRepository{
		keyVersions:  make(map[string]*types.KeyVersion),
		attestations: make(map[string]*types.MasterKeyAttestation),
	}
}

// CreateKeyVersion creates a new key version record.
func (m *MockRepository) CreateKeyVersion(ctx context.Context, v *types.KeyVersion) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.keyVersions[v.Version]; exists {
		return fmt.Errorf("key version already exists: %s", v.Version)
	}

	m.keyVersions[v.Version] = v
	return nil
}

// UpdateKeyStatus updates the status of a key version.
func (m *MockRepository) UpdateKeyStatus(ctx context.Context, version string, status types.KeyStatus, overlapEndsAt *time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	v, ok := m.keyVersions[version]
	if !ok {
		return fmt.Errorf("key version not found: %s", version)
	}

	v.Status = status
	v.OverlapEndsAt = overlapEndsAt

	if status == types.KeyStatusRevoked {
		now := time.Now()
		v.RevokedAt = &now
	}

	return nil
}

// GetKeyVersion retrieves a key version by version string.
func (m *MockRepository) GetKeyVersion(ctx context.Context, version string) (*types.KeyVersion, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	v, ok := m.keyVersions[version]
	if !ok {
		return nil, fmt.Errorf("key version not found: %s", version)
	}

	return v, nil
}

// ListKeyVersions lists key versions by status.
func (m *MockRepository) ListKeyVersions(ctx context.Context, statuses []types.KeyStatus) ([]*types.KeyVersion, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	statusSet := make(map[types.KeyStatus]bool)
	for _, s := range statuses {
		statusSet[s] = true
	}

	var result []*types.KeyVersion
	for _, v := range m.keyVersions {
		if len(statuses) == 0 || statusSet[v.Status] {
			result = append(result, v)
		}
	}

	return result, nil
}

// StoreAttestation stores an attestation artifact.
func (m *MockRepository) StoreAttestation(ctx context.Context, keyVersion string, att *types.MasterKeyAttestation) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.attestations[keyVersion] = att
	return nil
}

// GetAttestation retrieves an attestation by key version.
func (m *MockRepository) GetAttestation(ctx context.Context, keyVersion string) (*types.MasterKeyAttestation, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	att, ok := m.attestations[keyVersion]
	if !ok {
		return nil, fmt.Errorf("attestation not found for key version: %s", keyVersion)
	}

	return att, nil
}

var _ Repository = (*repository)(nil)
var _ Repository = (*MockRepository)(nil)
