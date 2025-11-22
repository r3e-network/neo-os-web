package jam

import (
	"context"
	"io"
)

// PreimageStore persists and fetches content-addressed blobs.
type PreimageStore interface {
	Stat(ctx context.Context, hash string) (Preimage, error)
	Get(ctx context.Context, hash string) (io.ReadCloser, error)
	Put(ctx context.Context, hash string, mediaType string, r io.Reader, size int64) (Preimage, error)
}

// Refiner executes the stateless preprocessing step for a work package.
type Refiner interface {
	Refine(ctx context.Context, pkg WorkPackage, store PreimageStore) (WorkReport, error)
}

// Attestor signs and returns an attestation for a given report hash.
type Attestor interface {
	Attest(ctx context.Context, report WorkReport) (Attestation, error)
}

// Accumulator applies a refined report to state, optionally emitting messages.
type Accumulator interface {
	Accumulate(ctx context.Context, report WorkReport, msgs []Message) error
}

// Disputer resolves conflicting reports and can mark them disputed.
type Disputer interface {
	Dispute(ctx context.Context, reportID string, reason string) error
}

// Scheduler decides which workers handle which packages.
type Scheduler interface {
	Assign(ctx context.Context, pkg WorkPackage) ([]string, error)
}
