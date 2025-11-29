package jam

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"time"
)

// ErrNotFound is returned when a requested resource is missing.
var ErrNotFound = errors.New("not found")

// MemPreimageStore keeps preimages in memory. Intended for tests and local dev.
type MemPreimageStore struct {
	data map[string]memPreimage
}

type memPreimage struct {
	meta Preimage
	data []byte
}

// NewMemPreimageStore constructs an empty in-memory preimage store.
func NewMemPreimageStore() *MemPreimageStore {
	return &MemPreimageStore{
		data: make(map[string]memPreimage),
	}
}

func (m *MemPreimageStore) Stat(_ context.Context, hash string) (Preimage, error) {
	p, ok := m.data[hash]
	if !ok {
		return Preimage{}, ErrNotFound
	}
	return p.meta, nil
}

func (m *MemPreimageStore) Get(_ context.Context, hash string) (io.ReadCloser, error) {
	p, ok := m.data[hash]
	if !ok {
		return nil, ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(p.data)), nil
}

func (m *MemPreimageStore) Put(_ context.Context, hash string, mediaType string, r io.Reader, size int64) (Preimage, error) {
	if hash == "" {
		return Preimage{}, errors.New("hash is required")
	}
	buf, err := io.ReadAll(r)
	if err != nil {
		return Preimage{}, err
	}
	if size > 0 && int64(len(buf)) != size {
		return Preimage{}, fmt.Errorf("size mismatch: expected %d got %d", size, len(buf))
	}
	sum := sha256.Sum256(buf)
	if hex.EncodeToString(sum[:]) != hash {
		return Preimage{}, errors.New("hash does not match content")
	}

	meta := Preimage{
		Hash:         hash,
		Size:         int64(len(buf)),
		MediaType:    mediaType,
		CreatedAt:    time.Now().UTC(),
		StorageClass: "",
		RefCount:     1,
	}
	m.data[hash] = memPreimage{meta: meta, data: buf}
	return meta, nil
}

// PGPreimageStore persists preimages in PostgreSQL.
type PGPreimageStore struct {
	DB *sql.DB
}

// NewPGPreimageStore constructs a Postgres-backed preimage store.
func NewPGPreimageStore(db *sql.DB) *PGPreimageStore {
	return &PGPreimageStore{DB: db}
}

func (p *PGPreimageStore) Stat(ctx context.Context, hash string) (Preimage, error) {
	var meta Preimage
	err := p.DB.QueryRowContext(ctx, `
		SELECT hash, size, media_type, created_at, uploader, storage_class, refcount
		FROM jam_preimages
		WHERE hash = $1
	`, hash).Scan(&meta.Hash, &meta.Size, &meta.MediaType, &meta.CreatedAt, &meta.Uploader, &meta.StorageClass, &meta.RefCount)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Preimage{}, ErrNotFound
		}
		return Preimage{}, err
	}
	return meta, nil
}

func (p *PGPreimageStore) Get(ctx context.Context, hash string) (io.ReadCloser, error) {
	var meta Preimage
	var data []byte
	err := p.DB.QueryRowContext(ctx, `
		SELECT hash, size, media_type, created_at, uploader, storage_class, refcount, data
		FROM jam_preimages
		WHERE hash = $1
	`, hash).Scan(&meta.Hash, &meta.Size, &meta.MediaType, &meta.CreatedAt, &meta.Uploader, &meta.StorageClass, &meta.RefCount, &data)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(data)), nil
}

func (p *PGPreimageStore) Put(ctx context.Context, hash string, mediaType string, r io.Reader, size int64) (Preimage, error) {
	if hash == "" {
		return Preimage{}, errors.New("hash is required")
	}
	buf, err := io.ReadAll(r)
	if err != nil {
		return Preimage{}, err
	}
	if size > 0 && int64(len(buf)) != size {
		return Preimage{}, fmt.Errorf("size mismatch: expected %d got %d", size, len(buf))
	}
	sum := sha256.Sum256(buf)
	if hex.EncodeToString(sum[:]) != hash {
		return Preimage{}, errors.New("hash does not match content")
	}

	meta := Preimage{
		Hash:         hash,
		Size:         int64(len(buf)),
		MediaType:    mediaType,
		CreatedAt:    time.Now().UTC(),
		Uploader:     "",
		StorageClass: "",
		RefCount:     1,
	}

	_, err = p.DB.ExecContext(ctx, `
		INSERT INTO jam_preimages (hash, size, media_type, data, created_at, uploader, storage_class, refcount)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (hash) DO UPDATE
		SET size = EXCLUDED.size,
		    media_type = EXCLUDED.media_type,
		    data = EXCLUDED.data,
		    refcount = jam_preimages.refcount + 1
	`, meta.Hash, meta.Size, meta.MediaType, buf, meta.CreatedAt, meta.Uploader, meta.StorageClass, meta.RefCount)
	if err != nil {
		return Preimage{}, err
	}
	return meta, nil
}
