package globalsigner

import (
	"context"
	"crypto/elliptic"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// =============================================================================
// Key Rotation
// =============================================================================

// rotationWorkerWithError checks if rotation is needed and performs it.
func (s *Service) rotationWorkerWithError(ctx context.Context) error {
	s.mu.RLock()
	activeEntry := s.keys[s.activeVersion]
	s.mu.RUnlock()

	if activeEntry == nil || activeEntry.version == nil {
		return nil
	}

	// Check if rotation is due
	activatedAt := activeEntry.version.ActivatedAt
	if activatedAt == nil {
		return nil
	}

	nextRotation := activatedAt.Add(s.rotationConfig.RotationPeriod)
	if time.Now().Before(nextRotation) {
		return nil
	}

	s.Logger().Info(ctx, "Rotation period reached, initiating key rotation...", nil)
	if _, err := s.rotate(ctx, false); err != nil {
		s.Logger().Error(ctx, "Automatic key rotation failed", err, nil)
		return err
	}
	return nil
}

// Rotate performs a key rotation.
func (s *Service) Rotate(ctx context.Context, force bool) (*RotateResponse, error) {
	return s.rotate(ctx, force)
}

func (s *Service) rotate(ctx context.Context, force bool) (*RotateResponse, error) {
	now := time.Now().UTC()
	newVersion := keyVersionFromTime(now)

	s.mu.Lock()
	oldVersion := s.activeVersion

	// Idempotency check
	if oldVersion == newVersion && !force {
		s.mu.Unlock()
		return &RotateResponse{
			OldVersion: oldVersion,
			NewVersion: newVersion,
			RotatedAt:  now,
			Rotated:    false,
		}, nil
	}
	s.mu.Unlock()

	// Derive new key
	priv, err := s.deriveKeyForVersion(newVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to derive new key: %w", err)
	}

	// Compute public key hash
	pubKeyBytes := elliptic.MarshalCompressed(priv.Curve, priv.PublicKey.X, priv.PublicKey.Y)
	pubKeyHex := hex.EncodeToString(pubKeyBytes)
	pubKeyHash := sha256.Sum256(pubKeyBytes)
	pubKeyHashHex := hex.EncodeToString(pubKeyHash[:])

	// Create new key version
	newKeyVersion := &KeyVersion{
		Version:     newVersion,
		Status:      KeyStatusActive,
		PubKeyHex:   pubKeyHex,
		PubKeyHash:  pubKeyHashHex,
		CreatedAt:   now,
		ActivatedAt: &now,
	}

	// Calculate overlap end time
	var overlapEndsAt *time.Time
	if oldVersion != "" {
		overlapEnd := now.Add(s.rotationConfig.OverlapPeriod)
		overlapEndsAt = &overlapEnd
	}

	attestation, err := s.buildAttestation(ctx, newVersion, pubKeyHex, pubKeyHashHex)
	if err != nil {
		return nil, err
	}

	// Update old key to overlapping status
	s.mu.Lock()
	if oldVersion != "" {
		if oldEntry, ok := s.keys[oldVersion]; ok {
			oldEntry.version.Status = KeyStatusOverlapping
			oldEntry.version.OverlapEndsAt = overlapEndsAt
		}
	}

	// Add new key
	s.keys[newVersion] = &keyEntry{
		privateKey: priv,
		version:    newKeyVersion,
	}
	s.activeVersion = newVersion
	s.rotationsCount++
	s.mu.Unlock()

	// Persist to repository
	if s.repo != nil {
		if oldVersion != "" {
			if err := s.repo.UpdateKeyStatus(ctx, oldVersion, KeyStatusOverlapping, overlapEndsAt); err != nil {
				s.Logger().Warn(ctx, "Failed to update old key status", map[string]interface{}{
					"error":       err.Error(),
					"old_version": oldVersion,
				})
			}
		}
		if err := s.repo.CreateKeyVersion(ctx, newKeyVersion); err != nil {
			s.Logger().Warn(ctx, "Failed to persist new key version", map[string]interface{}{"error": err.Error()})
		}
	}

	if s.repo != nil {
		if err := s.repo.StoreAttestation(ctx, newVersion, attestation); err != nil {
			s.Logger().Warn(ctx, "Failed to persist attestation", map[string]interface{}{
				"error":       err.Error(),
				"new_version": newVersion,
			})
		}
	}

	s.Logger().Info(ctx, "Key rotation completed", map[string]interface{}{
		"old_version":     oldVersion,
		"new_version":     newVersion,
		"overlap_ends_at": overlapEndsAt,
	})

	return &RotateResponse{
		OldVersion:    oldVersion,
		NewVersion:    newVersion,
		OverlapEndsAt: overlapEndsAt,
		RotatedAt:     now,
		Rotated:       true,
	}, nil
}

// keyVersionFromTime generates a version string from a timestamp.
func keyVersionFromTime(t time.Time) string {
	return fmt.Sprintf("v%d-%02d", t.Year(), t.Month())
}
