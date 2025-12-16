package neorand

// RandomRequest requests a new randomness proof.
type RandomRequest struct {
	AppID     string `json:"app_id,omitempty"`
	RequestID string `json:"request_id"`
	SeedHex   string `json:"seed_hex,omitempty"`

	// Anchor writes `(record_id -> randomness + attestation_hash + timestamp)` on-chain
	// via the RandomnessLog contract when configured.
	Anchor bool `json:"anchor,omitempty"`
	// Wait waits for the on-chain transaction execution if Anchor is true.
	Wait bool `json:"wait,omitempty"`
}

// RandomResponse is the response from /random.
type RandomResponse struct {
	AppID     string `json:"app_id,omitempty"`
	RequestID string `json:"request_id"`

	// RecordID is the value used as RandomnessLog key (hex-encoded, 32 bytes).
	RecordID string `json:"record_id"`
	// Payload is the domain-separated data payload (hex-encoded).
	Payload string `json:"payload"`

	Domain           string `json:"domain"`
	SigningMessage   string `json:"signing_message"`
	Randomness       string `json:"randomness"`
	Signature        string `json:"signature"`
	PublicKey        string `json:"public_key"`
	AttestationHash  string `json:"attestation_hash"`
	KeyVersion       string `json:"key_version,omitempty"`
	Anchored         bool   `json:"anchored"`
	AnchorTxHash     string `json:"anchor_tx_hash,omitempty"`
	AnchorVMState    string `json:"anchor_vm_state,omitempty"`
	AnchorException  string `json:"anchor_exception,omitempty"`
	TimestampUnixSec uint64 `json:"timestamp_unix_sec"`

	Attestation *Attestation `json:"attestation,omitempty"`
}

// Attestation carries optional signer attestation metadata.
// When GlobalSigner is used, this is fetched from `/attestation` (cached).
type Attestation struct {
	KeyVersion string `json:"key_version,omitempty"`
	PubKeyHex  string `json:"pubkey_hex,omitempty"`
	PubKeyHash string `json:"pubkey_hash,omitempty"`
	Quote      string `json:"quote,omitempty"`
	MRENCLAVE  string `json:"mrenclave,omitempty"`
	MRSIGNER   string `json:"mrsigner,omitempty"`
	Timestamp  string `json:"timestamp,omitempty"`
	Simulated  bool   `json:"simulated,omitempty"`
}

// VerifyRequest verifies a proof returned by /random.
type VerifyRequest struct {
	Domain    string `json:"domain"`
	Payload   string `json:"payload"`   // hex
	Signature string `json:"signature"` // hex
	PublicKey string `json:"public_key"`
}

// VerifyResponse is returned by /verify.
type VerifyResponse struct {
	Valid bool   `json:"valid"`
	Error string `json:"error,omitempty"`
}

