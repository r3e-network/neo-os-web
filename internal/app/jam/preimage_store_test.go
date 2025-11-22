package jam

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"strings"
	"testing"
)

func TestMemPreimageStorePutGetStat(t *testing.T) {
	store := NewMemPreimageStore()
	content := []byte("hello jam")
	sum := sha256.Sum256(content)
	hash := hex.EncodeToString(sum[:])

	meta, err := store.Put(context.Background(), hash, "text/plain", bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("put failed: %v", err)
	}
	if meta.Hash != hash || meta.Size != int64(len(content)) {
		t.Fatalf("meta mismatch: %+v", meta)
	}
	rc, err := store.Get(context.Background(), hash)
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	defer rc.Close()
	readBack, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	if string(readBack) != string(content) {
		t.Fatalf("content mismatch: %s", string(readBack))
	}
	if _, err := store.Stat(context.Background(), hash); err != nil {
		t.Fatalf("stat failed: %v", err)
	}
}

func TestMemPreimageStoreRejectsWrongHash(t *testing.T) {
	store := NewMemPreimageStore()
	_, err := store.Put(context.Background(), "deadbeef", "text/plain", strings.NewReader("hi"), 2)
	if err == nil {
		t.Fatalf("expected hash mismatch error")
	}
}
