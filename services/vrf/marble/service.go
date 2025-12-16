// Package neorand provides verifiable randomness for the service layer.
//
// This implementation is intentionally simple:
// - It produces a proof by signing a stable, domain-separated payload.
// - Randomness is derived as SHA256(signature).
// - Optionally anchors results on-chain via the RandomnessLog contract.
package neorand

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/R3E-Network/service_layer/infrastructure/chain"
	"github.com/R3E-Network/service_layer/infrastructure/crypto"
	"github.com/R3E-Network/service_layer/infrastructure/database"
	gsclient "github.com/R3E-Network/service_layer/infrastructure/globalsigner/client"
	"github.com/R3E-Network/service_layer/infrastructure/marble"
	"github.com/R3E-Network/service_layer/infrastructure/middleware"
	"github.com/R3E-Network/service_layer/infrastructure/runtime"
	commonservice "github.com/R3E-Network/service_layer/infrastructure/service"
)

const (
	ServiceID   = "neorand"
	ServiceName = "NeoRand Service"
	Version     = "3.0.0"

	defaultDomain = "vrf:proof"
)

// Service implements the VRF/randomness service.
type Service struct {
	*commonservice.BaseService

	// Signer selection
	mu       sync.RWMutex
	gsClient *gsclient.Client
	localKey *ecdsa.PrivateKey

	// Cached GlobalSigner attestation (optional)
	attMu       sync.RWMutex
	attestation *Attestation
	attFetched  time.Time

	// Chain anchoring
	chainClient   *chain.Client
	chainSigner   chain.TEESigner
	randomnessLog *chain.RandomnessLogContract

	attestationCacheTTL time.Duration
}

// Config holds NeoRand service configuration.
type Config struct {
	Marble *marble.Marble
	DB     database.RepositoryInterface

	// GlobalSignerURL enables GlobalSigner-backed proofs (preferred in production).
	GlobalSignerURL string

	// Optional local key (development/testing). In strict mode this is required
	// if GlobalSignerURL is not configured.
	VRFPrivateKeyHex string

	// Optional on-chain anchoring.
	ChainClient        *chain.Client
	ChainSigner        chain.TEESigner
	RandomnessLogHash  string
	AttestationCacheTTL time.Duration
}

// New creates a new NeoRand service.
func New(cfg Config) (*Service, error) {
	if cfg.Marble == nil {
		return nil, fmt.Errorf("neorand: marble is required")
	}

	strict := runtime.StrictIdentityMode() || cfg.Marble.IsEnclave()

	base := commonservice.NewBase(&commonservice.BaseConfig{
		ID:      ServiceID,
		Name:    ServiceName,
		Version: Version,
		Marble:  cfg.Marble,
		DB:      cfg.DB,
	})

	ttl := cfg.AttestationCacheTTL
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}

	svc := &Service{
		BaseService:          base,
		chainClient:          cfg.ChainClient,
		chainSigner:          cfg.ChainSigner,
		attestationCacheTTL:  ttl,
	}

	if cfg.RandomnessLogHash != "" && cfg.ChainClient != nil && cfg.ChainSigner != nil {
		svc.randomnessLog = chain.NewRandomnessLogContract(cfg.ChainClient, cfg.RandomnessLogHash)
	}

	svc.WithHydrate(func(ctx context.Context) error {
		return svc.hydrateSigner(ctx, cfg, strict)
	})

	// Routes
	base.RegisterStandardRoutes()
	svc.registerRoutes()

	return svc, nil
}

func (s *Service) registerRoutes() {
	// Produces signed randomness proofs; should generally only be reachable via gateway/edge.
	s.Router().Handle("/random", middleware.RequireServiceAuth(http.HandlerFunc(s.handleRandom))).Methods(http.MethodPost)

	// Public verification helper (does not require secrets).
	s.Router().HandleFunc("/verify", s.handleVerify).Methods(http.MethodPost)
}

func (s *Service) hydrateSigner(ctx context.Context, cfg Config, strict bool) error {
	globalSignerURL := strings.TrimSpace(cfg.GlobalSignerURL)
	if globalSignerURL == "" {
		if secret, ok := s.Marble().Secret("GLOBALSIGNER_SERVICE_URL"); ok && len(secret) > 0 {
			globalSignerURL = strings.TrimSpace(string(secret))
		}
	}
	if globalSignerURL == "" {
		globalSignerURL = strings.TrimSpace(os.Getenv("GLOBALSIGNER_SERVICE_URL"))
	}

	if globalSignerURL != "" {
		client, err := gsclient.New(gsclient.Config{
			BaseURL:    globalSignerURL,
			ServiceID:  ServiceID,
			HTTPClient: s.Marble().HTTPClient(),
			Timeout:    15 * time.Second,
		})
		if err != nil {
			return fmt.Errorf("neorand: init globalsigner client: %w", err)
		}
		s.mu.Lock()
		s.gsClient = client
		s.mu.Unlock()
		if _, err := s.getAttestationCached(ctx, true); err != nil {
			// Do not fail the service purely on attestation fetch; signing can still work.
			s.Logger().WithContext(ctx).WithError(err).Warn("neorand: fetch globalsigner attestation failed")
		}
		s.Logger().WithContext(ctx).Info("neorand: using GlobalSigner for proofs")
		return nil
	}

	// Fallback: local private key (dev/testing) injected by MarbleRun or env.
	keyHex := strings.TrimSpace(cfg.VRFPrivateKeyHex)
	if keyHex == "" {
		if secret, ok := s.Marble().Secret("VRF_PRIVATE_KEY"); ok && len(secret) > 0 {
			keyHex = hex.EncodeToString(secret)
		}
	}
	if keyHex == "" {
		keyHex = strings.TrimSpace(os.Getenv("VRF_PRIVATE_KEY"))
	}
	keyHex = strings.TrimPrefix(strings.TrimPrefix(keyHex, "0x"), "0X")

	if keyHex == "" {
		if strict {
			return fmt.Errorf("neorand: GLOBALSIGNER_SERVICE_URL or VRF_PRIVATE_KEY is required in strict/enclave mode")
		}

		s.Logger().WithContext(ctx).Warn("neorand: no signer configured; generating ephemeral key (development/testing only)")
		kp, err := crypto.GenerateKeyPair()
		if err != nil {
			return fmt.Errorf("neorand: generate keypair: %w", err)
		}
		s.mu.Lock()
		s.localKey = kp.PrivateKey
		s.mu.Unlock()
		return nil
	}

	keyBytes, err := hex.DecodeString(keyHex)
	if err != nil {
		return fmt.Errorf("neorand: decode VRF_PRIVATE_KEY: %w", err)
	}
	if len(keyBytes) != 32 {
		return fmt.Errorf("neorand: VRF_PRIVATE_KEY must be 32 bytes, got %d", len(keyBytes))
	}

	curve := elliptic.P256()
	d := new(big.Int).SetBytes(keyBytes)
	nMinus1 := new(big.Int).Sub(curve.Params().N, big.NewInt(1))
	d.Mod(d, nMinus1)
	d.Add(d, big.NewInt(1))

	privateKey := new(ecdsa.PrivateKey)
	privateKey.Curve = curve
	privateKey.D = d
	privateKey.PublicKey.X, privateKey.PublicKey.Y = curve.ScalarBaseMult(d.Bytes())

	s.mu.Lock()
	s.localKey = privateKey
	s.mu.Unlock()

	return nil
}

func (s *Service) getAttestationCached(ctx context.Context, force bool) (*Attestation, error) {
	s.mu.RLock()
	client := s.gsClient
	s.mu.RUnlock()
	if client == nil {
		return nil, fmt.Errorf("globalsigner not configured")
	}

	s.attMu.RLock()
	cached := s.attestation
	cachedAt := s.attFetched
	s.attMu.RUnlock()

	if !force && cached != nil && time.Since(cachedAt) < s.attestationCacheTTL {
		return cached, nil
	}

	att, err := client.GetAttestation(ctx)
	if err != nil {
		return nil, err
	}

	converted := &Attestation{
		KeyVersion: att.KeyVersion,
		PubKeyHex:  att.PubKeyHex,
		PubKeyHash: att.PubKeyHash,
		Quote:      att.Quote,
		MRENCLAVE:  att.MRENCLAVE,
		MRSIGNER:   att.MRSIGNER,
		Timestamp:  att.Timestamp,
		Simulated:  att.Simulated,
	}

	s.attMu.Lock()
	s.attestation = converted
	s.attFetched = time.Now()
	s.attMu.Unlock()

	return converted, nil
}

// Random generates a randomness proof and optionally anchors it on-chain.
func (s *Service) Random(ctx context.Context, req *RandomRequest) (*RandomResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("request required")
	}
	requestID := strings.TrimSpace(req.RequestID)
	if requestID == "" {
		return nil, fmt.Errorf("request_id required")
	}
	if len(requestID) > 256 {
		return nil, fmt.Errorf("request_id too long")
	}
	appID := strings.TrimSpace(req.AppID)
	if len(appID) > 128 {
		return nil, fmt.Errorf("app_id too long")
	}

	seedBytes, err := decodeHexOptional(req.SeedHex)
	if err != nil {
		return nil, err
	}
	if len(seedBytes) > 64 {
		return nil, fmt.Errorf("seed too long")
	}

	payload := buildPayload(appID, requestID, seedBytes)
	recordID := crypto.Hash256(payload) // 32 bytes, stable key for on-chain log
	signingMessage := buildSigningMessage(defaultDomain, payload)

	signature, pubKey, keyVersion, err := s.signProof(ctx, defaultDomain, payload, signingMessage)
	if err != nil {
		return nil, err
	}

	randomness := crypto.Hash256(signature)
	attHash := crypto.Hash256(pubKey)

	now := uint64(time.Now().UTC().Unix())

	resp := &RandomResponse{
		AppID:             appID,
		RequestID:         requestID,
		RecordID:          hex.EncodeToString(recordID),
		Payload:           hex.EncodeToString(payload),
		Domain:            defaultDomain,
		SigningMessage:    hex.EncodeToString(signingMessage),
		Randomness:        hex.EncodeToString(randomness),
		Signature:         hex.EncodeToString(signature),
		PublicKey:         hex.EncodeToString(pubKey),
		AttestationHash:   hex.EncodeToString(attHash),
		KeyVersion:        keyVersion,
		TimestampUnixSec:  now,
	}

	if s.gsClient != nil {
		if att, err := s.getAttestationCached(ctx, false); err == nil {
			resp.Attestation = att
		}
	}

	if req.Anchor {
		if s.randomnessLog == nil || s.chainClient == nil || s.chainSigner == nil {
			return nil, fmt.Errorf("anchoring is not configured (missing chain client/signer/randomnesslog hash)")
		}

		txRes, err := s.randomnessLog.Record(ctx, s.chainSigner, recordID, randomness, attHash, now, req.Wait)
		if err != nil {
			return nil, fmt.Errorf("anchor on-chain: %w", err)
		}

		resp.Anchored = true
		if txRes != nil {
			resp.AnchorTxHash = txRes.TxHash
			resp.AnchorVMState = txRes.VMState
			if txRes.AppLog != nil && len(txRes.AppLog.Executions) > 0 {
				resp.AnchorException = txRes.AppLog.Executions[0].Exception
			}
		}
	}

	return resp, nil
}

// Verify verifies a proof tuple produced by /random.
func (s *Service) Verify(req *VerifyRequest) (*VerifyResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("request required")
	}
	domain := strings.TrimSpace(req.Domain)
	if domain == "" {
		return nil, fmt.Errorf("domain required")
	}

	payload, err := decodeHexRequired("payload", req.Payload)
	if err != nil {
		return nil, err
	}
	signature, err := decodeHexRequired("signature", req.Signature)
	if err != nil {
		return nil, err
	}
	pubKey, err := decodeHexRequired("public_key", req.PublicKey)
	if err != nil {
		return nil, err
	}
	if len(signature) != 64 {
		return &VerifyResponse{Valid: false, Error: "invalid signature length"}, nil
	}

	signingMessage := buildSigningMessage(domain, payload)

	parsedPub, err := crypto.PublicKeyFromBytes(pubKey)
	if err != nil {
		return &VerifyResponse{Valid: false, Error: "invalid public key"}, nil
	}

	valid := crypto.Verify(parsedPub, signingMessage, signature)
	return &VerifyResponse{Valid: valid}, nil
}

// =============================================================================
// Helpers
// =============================================================================

func (s *Service) signProof(ctx context.Context, domain string, payload, signingMessage []byte) ([]byte, []byte, string, error) {
	s.mu.RLock()
	gs := s.gsClient
	local := s.localKey
	s.mu.RUnlock()

	if gs != nil {
		resp, err := gs.Sign(ctx, &gsclient.SignRequest{
			Domain: domain,
			Data:   hex.EncodeToString(payload),
		})
		if err != nil {
			return nil, nil, "", fmt.Errorf("globalsigner sign: %w", err)
		}

		sig, err := decodeHexRequired("signature", resp.Signature)
		if err != nil {
			return nil, nil, "", err
		}
		pub, err := decodeHexRequired("pubkey_hex", resp.PubKeyHex)
		if err != nil {
			return nil, nil, "", err
		}
		return sig, pub, resp.KeyVersion, nil
	}

	if local == nil {
		return nil, nil, "", fmt.Errorf("no signer configured")
	}

	sig, err := crypto.Sign(local, signingMessage)
	if err != nil {
		return nil, nil, "", fmt.Errorf("local sign: %w", err)
	}
	pub := crypto.PublicKeyToBytes(&local.PublicKey)
	return sig, pub, "local", nil
}

func buildPayload(appID, requestID string, seed []byte) []byte {
	// Stable, byte-oriented encoding:
	// "neorand:v1" 0x00 app_id 0x00 request_id 0x00 seed_bytes
	prefix := []byte("neorand:v1")
	payload := make([]byte, 0, len(prefix)+1+len(appID)+1+len(requestID)+1+len(seed))
	payload = append(payload, prefix...)
	payload = append(payload, 0x00)
	payload = append(payload, []byte(appID)...)
	payload = append(payload, 0x00)
	payload = append(payload, []byte(requestID)...)
	payload = append(payload, 0x00)
	payload = append(payload, seed...)
	return payload
}

func buildSigningMessage(domain string, payload []byte) []byte {
	msg := make([]byte, 0, len(domain)+1+len(payload))
	msg = append(msg, []byte(domain)...)
	msg = append(msg, 0x00)
	msg = append(msg, payload...)
	return msg
}

func decodeHexOptional(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(strings.TrimPrefix(raw, "0x"), "0X")
	if raw == "" {
		return nil, nil
	}
	decoded, err := hex.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid seed_hex: %w", err)
	}
	return decoded, nil
}

func decodeHexRequired(field, raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(strings.TrimPrefix(raw, "0x"), "0X")
	if raw == "" {
		return nil, fmt.Errorf("%s required", field)
	}
	decoded, err := hex.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid %s: %w", field, err)
	}
	return decoded, nil
}
