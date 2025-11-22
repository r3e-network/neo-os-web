package jam

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/zeebo/blake3"
)

const (
	ReceiptTypePackage ReceiptType = "package"
	ReceiptTypeReport  ReceiptType = "report"
)

// ReceiptType identifies the kind of entry captured in a receipt.
type ReceiptType string

// Receipt records accumulator inclusion metadata for a package or report.
type Receipt struct {
	Hash         string         `json:"hash"`
	ServiceID    string         `json:"service_id"`
	EntryType    ReceiptType    `json:"entry_type"`
	Seq          int64          `json:"seq"`
	PrevRoot     string         `json:"prev_root"`
	NewRoot      string         `json:"new_root"`
	Status       string         `json:"status"`
	ProcessedAt  time.Time      `json:"processed_at"`
	MetadataHash string         `json:"metadata_hash"`
	Extra        map[string]any `json:"extra,omitempty"`
}

// AccumulatorRoot tracks the latest root for a service.
type AccumulatorRoot struct {
	ServiceID string    `json:"service_id"`
	Seq       int64     `json:"seq"`
	Root      string    `json:"root"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ReceiptInput captures the fields needed to append to the accumulator.
type ReceiptInput struct {
	Hash         string
	ServiceID    string
	EntryType    ReceiptType
	Status       string
	ProcessedAt  time.Time
	MetadataHash string
	Extra        map[string]any
}

// hashStrings concatenates and hashes the provided strings with the chosen algorithm.
func hashStrings(algo string, parts ...string) string {
	algo = strings.TrimSpace(strings.ToLower(algo))
	switch algo {
	case "blake3", "blake3-256":
		h := blake3.New()
		for _, p := range parts {
			_, _ = h.Write([]byte(p))
		}
		sum := h.Sum(nil)
		return hex.EncodeToString(sum[:])
	default:
		h := sha256.New()
		for _, p := range parts {
			_, _ = h.Write([]byte(p))
		}
		return hex.EncodeToString(h.Sum(nil))
	}
}

// reportMetadataHash hashes the report payload deterministically.
func reportMetadataHash(report WorkReport, algo string) string {
	b, _ := json.Marshal(report)
	return hashStrings(algo, string(b))
}

// packageMetadataHash hashes the package payload deterministically.
func packageMetadataHash(pkg WorkPackage, algo string) string {
	b, _ := json.Marshal(pkg)
	return hashStrings(algo, string(b))
}

// deriveRoot computes the next accumulator root given the previous root and input.
func deriveRoot(prevRoot string, in ReceiptInput, seq int64, algo string) (string, error) {
	if in.ProcessedAt.IsZero() {
		in.ProcessedAt = time.Now().UTC()
	}
	parts := []string{
		prevRoot,
		string(in.EntryType),
		in.Hash,
		in.MetadataHash,
		in.Status,
		strconv.FormatInt(seq, 10),
		in.ProcessedAt.UTC().Format(time.RFC3339Nano),
	}
	return hashStrings(algo, parts...), nil
}
