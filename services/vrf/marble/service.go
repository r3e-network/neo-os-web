// Package neovrf provides verifiable randomness service.
package neovrf

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"fmt"
	"math/big"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/crypto"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	commonservice "github.com/R3E-Network/service_layer/infrastructure/service"
)

const (
	ServiceID   = "neovrf"
	ServiceName = "NeoVRF Service"
	Version     = "1.0.0"
)

// Service implements the VRF service.
type Service struct {
	*commonservice.BaseService
	signingKey      []byte
	privateKey      *ecdsa.PrivateKey
	publicKey       []byte
	attestationHash []byte
	replayWindow    time.Duration
	replayMu        sync.Mutex
	seenRequests    map[string]time.Time
}

// Config holds VRF service configuration.
type Config struct {
	Marble       *marble.Marble
	DB           database.RepositoryInterface
	ReplayWindow time.Duration
}

// New creates a new NeoVRF service.
func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neovrf: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()

	requiredSecrets := []string(nil)
	if strict {
		requiredSecrets = []string{"NEOVRF_SIGNING_KEY"}
	}

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:              ServiceID,
		Name:            ServiceName,
		Version:         Version,
		Marble:          cfg.Marble,
		DB:              cfg.DB,
		RequiredSecrets: requiredSecrets,
	})

	s := &Service{
		BaseService: base,
	}
	s.attestationHash = marble.ComputeAttestationHash(cfg.Marble, ServiceID)

	if key, ok := cfg.Marble.Secret("NEOVRF_SIGNING_KEY"); ok && len(key) >= 32 {
		s.signingKey = key
	} else if strict {
		return nil, fmt.Errorf("neovrf: NEOVRF_SIGNING_KEY is required and must be at least 32 bytes")
	} else {
		s.Logger().WithFields(nil).Warn("NEOVRF_SIGNING_KEY not configured; generating ephemeral signing key (development/testing only)")
	}

	if err := s.initSigningKey(); err != nil {
		return nil, err
	}

	replayWindow := cfg.ReplayWindow
	if replayWindow <= 0 {
		if parsed, ok := parseEnvDuration("NEOVRF_REPLAY_WINDOW"); ok {
			replayWindow = parsed
		}
	}
	if replayWindow <= 0 {
		replayWindow = 10 * time.Minute
	}
	s.replayWindow = replayWindow
	s.seenRequests = make(map[string]time.Time)

	base.WithStats(s.statistics)
	base.RegisterStandardRoutes()
	s.registerRoutes()

	base.AddTickerWorker(1*time.Minute, func(ctx context.Context) error {
		s.cleanupReplay()
		return nil
	}, commonservice.WithTickerWorkerName("replay-cleanup"))

	return s, nil
}

// markSeen checks if a request has been seen within the replay window.
// SECURITY: Returns false if request was already seen (replay attack).
// Returns true if this is a new request and marks it as seen.
// IMPORTANT: Empty requestID is explicitly rejected as a security measure.
func (s *Service) markSeen(requestID string) bool {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		// SECURITY: Reject empty request IDs to prevent bypass of replay protection
		s.Logger().Warn(context.Background(), "VRF request rejected: empty requestID", nil)
		return false
	}

	// SECURITY: Require minimum requestID length for entropy
	if len(requestID) < 16 {
		s.Logger().Warn(context.Background(), "VRF request rejected: requestID too short (min 16 chars)", map[string]any{
			"request_id_length": len(requestID),
		})
		return false
	}

	now := time.Now()
	s.replayMu.Lock()
	defer s.replayMu.Unlock()

	if until, ok := s.seenRequests[requestID]; ok && now.Before(until) {
		s.Logger().Warn(context.Background(), "VRF replay attack detected", map[string]any{
			"request_id": requestID,
			"expires_at": until,
		})
		return false
	}

	s.seenRequests[requestID] = now.Add(s.replayWindow)
	return true
}

func (s *Service) cleanupReplay() {
	now := time.Now()
	s.replayMu.Lock()
	defer s.replayMu.Unlock()

	for key, until := range s.seenRequests {
		if now.After(until) {
			delete(s.seenRequests, key)
		}
	}
}

func parseEnvDuration(key string) (time.Duration, bool) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0, false
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil {
		return 0, false
	}
	return parsed, true
}

func (s *Service) initSigningKey() error {
	if len(s.signingKey) >= 32 {
		priv, pub, err := deriveSigningKey(s.signingKey)
		if err != nil {
			return fmt.Errorf("neovrf: derive signing key: %w", err)
		}
		s.privateKey = priv
		s.publicKey = pub
		return nil
	}

	keyPair, err := crypto.GenerateKeyPair()
	if err != nil {
		return fmt.Errorf("neovrf: generate signing key: %w", err)
	}
	s.privateKey = keyPair.PrivateKey
	s.publicKey = crypto.PublicKeyToBytes(keyPair.PublicKey)
	return nil
}

func deriveSigningKey(master []byte) (*ecdsa.PrivateKey, []byte, error) {
	seed, err := crypto.DeriveKey(master, nil, "vrf-signing", 32)
	if err != nil {
		return nil, nil, err
	}
	defer crypto.ZeroBytes(seed)

	curve := elliptic.P256()
	d := new(big.Int).SetBytes(seed)
	n := new(big.Int).Sub(curve.Params().N, big.NewInt(1))
	d.Mod(d, n)
	d.Add(d, big.NewInt(1))

	priv := &ecdsa.PrivateKey{PublicKey: ecdsa.PublicKey{Curve: curve}, D: d}
	priv.PublicKey.X, priv.PublicKey.Y = curve.ScalarBaseMult(d.Bytes())

	pub := crypto.PublicKeyToBytes(&priv.PublicKey)
	return priv, pub, nil
}

func (s *Service) statistics() map[string]any {
	stats := map[string]any{
		"attestation_hash": fmt.Sprintf("%x", s.attestationHash),
	}
	if len(s.publicKey) > 0 {
		stats["public_key"] = fmt.Sprintf("%x", s.publicKey)
	}
	return stats
}
