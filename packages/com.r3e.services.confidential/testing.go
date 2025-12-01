package confidential

import (
	"context"
	"sync"

	"github.com/R3E-Network/service_layer/pkg/testutil"
	"github.com/google/uuid"
)

// MemoryStore is an in-memory implementation of Store for testing.
type MemoryStore struct {
	mu           sync.RWMutex
	enclaves     map[string]Enclave
	sealedKeys   map[string]SealedKey
	attestations map[string]Attestation
}

// NewMemoryStore creates a new in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		enclaves:     make(map[string]Enclave),
		sealedKeys:   make(map[string]SealedKey),
		attestations: make(map[string]Attestation),
	}
}

func (s *MemoryStore) CreateEnclave(ctx context.Context, e Enclave) (Enclave, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	s.enclaves[e.ID] = e
	return e, nil
}

func (s *MemoryStore) UpdateEnclave(ctx context.Context, e Enclave) (Enclave, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.enclaves[e.ID] = e
	return e, nil
}

func (s *MemoryStore) GetEnclave(ctx context.Context, id string) (Enclave, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if e, ok := s.enclaves[id]; ok {
		return e, nil
	}
	return Enclave{}, nil
}

func (s *MemoryStore) ListEnclaves(ctx context.Context, accountID string) ([]Enclave, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []Enclave
	for _, e := range s.enclaves {
		if e.AccountID == accountID {
			result = append(result, e)
		}
	}
	return result, nil
}

func (s *MemoryStore) CreateSealedKey(ctx context.Context, k SealedKey) (SealedKey, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if k.ID == "" {
		k.ID = uuid.NewString()
	}
	s.sealedKeys[k.ID] = k
	return k, nil
}

func (s *MemoryStore) ListSealedKeys(ctx context.Context, accountID, enclaveID string, limit int) ([]SealedKey, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []SealedKey
	for _, k := range s.sealedKeys {
		if k.AccountID == accountID && k.EnclaveID == enclaveID {
			result = append(result, k)
		}
	}
	return result, nil
}

func (s *MemoryStore) CreateAttestation(ctx context.Context, a Attestation) (Attestation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	s.attestations[a.ID] = a
	return a, nil
}

func (s *MemoryStore) ListAttestations(ctx context.Context, accountID, enclaveID string, limit int) ([]Attestation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []Attestation
	for _, a := range s.attestations {
		if a.AccountID == accountID && a.EnclaveID == enclaveID {
			result = append(result, a)
		}
	}
	return result, nil
}

func (s *MemoryStore) ListAccountAttestations(ctx context.Context, accountID string, limit int) ([]Attestation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []Attestation
	for _, a := range s.attestations {
		if a.AccountID == accountID {
			result = append(result, a)
		}
	}
	return result, nil
}

// Re-export centralized mock for convenience.
type MockAccountChecker = testutil.MockAccountChecker

// NewMockAccountChecker creates a new mock account checker.
var NewMockAccountChecker = testutil.NewMockAccountChecker
