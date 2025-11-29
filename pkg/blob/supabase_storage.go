// Package blob provides Supabase Storage-based blob storage.
// This replaces JAM's PostgreSQL bytea storage with Supabase Storage.
package blob

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"path"
	"strings"

	"github.com/R3E-Network/service_layer/pkg/supabase"
)

// Storage provides blob storage operations via Supabase Storage.
type Storage struct {
	client     *supabase.Client
	bucketName string
}

// NewStorage creates a new Supabase Storage-based blob storage.
func NewStorage(client *supabase.Client, bucketName string) *Storage {
	if bucketName == "" {
		bucketName = "blobs"
	}
	return &Storage{
		client:     client,
		bucketName: bucketName,
	}
}

// Upload uploads a blob to Supabase Storage.
func (s *Storage) Upload(ctx context.Context, key string, data []byte, contentType string) error {
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return s.client.UploadFile(ctx, s.bucketName, sanitizeKey(key), bytes.NewReader(data), contentType)
}

// UploadReader uploads a blob from an io.Reader.
func (s *Storage) UploadReader(ctx context.Context, key string, reader io.Reader, contentType string) error {
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return s.client.UploadFile(ctx, s.bucketName, sanitizeKey(key), reader, contentType)
}

// Download downloads a blob from Supabase Storage.
func (s *Storage) Download(ctx context.Context, key string) ([]byte, error) {
	reader, err := s.client.DownloadFile(ctx, s.bucketName, sanitizeKey(key))
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

// DownloadReader returns an io.ReadCloser for streaming downloads.
func (s *Storage) DownloadReader(ctx context.Context, key string) (io.ReadCloser, error) {
	return s.client.DownloadFile(ctx, s.bucketName, sanitizeKey(key))
}

// Delete removes a blob from Supabase Storage.
func (s *Storage) Delete(ctx context.Context, key string) error {
	return s.client.DeleteFile(ctx, s.bucketName, sanitizeKey(key))
}

// GetPublicURL returns the public URL for a blob.
func (s *Storage) GetPublicURL(key string) string {
	return s.client.GetPublicURL(s.bucketName, sanitizeKey(key))
}

// Exists checks if a blob exists.
func (s *Storage) Exists(ctx context.Context, key string) (bool, error) {
	reader, err := s.client.DownloadFile(ctx, s.bucketName, sanitizeKey(key))
	if err != nil {
		// Check if it's a not found error
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, err
	}
	reader.Close()
	return true, nil
}

// ============================================================================
// JAM-Compatible Interface
// ============================================================================

// JAMStore provides a JAM-compatible interface using Supabase Storage.
type JAMStore struct {
	storage *Storage
}

// NewJAMStore creates a JAM-compatible store backed by Supabase Storage.
func NewJAMStore(client *supabase.Client) *JAMStore {
	return &JAMStore{
		storage: NewStorage(client, "jam"),
	}
}

// StorePackage stores a JAM package.
func (j *JAMStore) StorePackage(ctx context.Context, hash string, data []byte) error {
	key := fmt.Sprintf("packages/%s", hash)
	return j.storage.Upload(ctx, key, data, "application/octet-stream")
}

// GetPackage retrieves a JAM package.
func (j *JAMStore) GetPackage(ctx context.Context, hash string) ([]byte, error) {
	key := fmt.Sprintf("packages/%s", hash)
	return j.storage.Download(ctx, key)
}

// HasPackage checks if a JAM package exists.
func (j *JAMStore) HasPackage(ctx context.Context, hash string) (bool, error) {
	key := fmt.Sprintf("packages/%s", hash)
	return j.storage.Exists(ctx, key)
}

// StorePreimage stores a preimage.
func (j *JAMStore) StorePreimage(ctx context.Context, hash string, data []byte) error {
	key := fmt.Sprintf("preimages/%s", hash)
	return j.storage.Upload(ctx, key, data, "application/octet-stream")
}

// GetPreimage retrieves a preimage.
func (j *JAMStore) GetPreimage(ctx context.Context, hash string) ([]byte, error) {
	key := fmt.Sprintf("preimages/%s", hash)
	return j.storage.Download(ctx, key)
}

// HasPreimage checks if a preimage exists.
func (j *JAMStore) HasPreimage(ctx context.Context, hash string) (bool, error) {
	key := fmt.Sprintf("preimages/%s", hash)
	return j.storage.Exists(ctx, key)
}

// ============================================================================
// Tenant-Scoped Storage
// ============================================================================

// TenantStorage provides tenant-isolated blob storage.
type TenantStorage struct {
	client   *supabase.Client
	tenantID string
}

// NewTenantStorage creates a tenant-scoped storage.
func NewTenantStorage(client *supabase.Client, tenantID string) *TenantStorage {
	return &TenantStorage{
		client:   client,
		tenantID: tenantID,
	}
}

// Upload uploads a file to the tenant's storage.
func (t *TenantStorage) Upload(ctx context.Context, key string, data []byte, contentType string) error {
	fullKey := t.tenantKey(key)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return t.client.UploadFile(ctx, "tenant-files", fullKey, bytes.NewReader(data), contentType)
}

// Download downloads a file from the tenant's storage.
func (t *TenantStorage) Download(ctx context.Context, key string) ([]byte, error) {
	fullKey := t.tenantKey(key)
	reader, err := t.client.DownloadFile(ctx, "tenant-files", fullKey)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

// Delete removes a file from the tenant's storage.
func (t *TenantStorage) Delete(ctx context.Context, key string) error {
	fullKey := t.tenantKey(key)
	return t.client.DeleteFile(ctx, "tenant-files", fullKey)
}

// GetPublicURL returns the public URL for a tenant's file.
func (t *TenantStorage) GetPublicURL(key string) string {
	fullKey := t.tenantKey(key)
	return t.client.GetPublicURL("tenant-files", fullKey)
}

func (t *TenantStorage) tenantKey(key string) string {
	return path.Join(t.tenantID, sanitizeKey(key))
}

// ============================================================================
// Helpers
// ============================================================================

func sanitizeKey(key string) string {
	// Remove leading slashes and sanitize path
	key = strings.TrimPrefix(key, "/")
	key = path.Clean(key)
	// Prevent directory traversal
	key = strings.ReplaceAll(key, "..", "_")
	return key
}
