package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	domainds "github.com/R3E-Network/service_layer/internal/app/domain/datastreams"
	"github.com/google/uuid"
)

// --- DataStreamStore -------------------------------------------------------

func (s *Store) CreateStream(ctx context.Context, stream domainds.Stream) (domainds.Stream, error) {
	if stream.ID == "" {
		stream.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	stream.CreatedAt = now
	stream.UpdatedAt = now
	tenant := s.accountTenant(ctx, stream.AccountID)

	metaJSON, err := json.Marshal(stream.Metadata)
	if err != nil {
		return domainds.Stream{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO chainlink_datastreams
			(id, account_id, name, symbol, description, frequency, sla_ms, status, metadata, tenant, created_at, updated_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, stream.ID, stream.AccountID, stream.Name, stream.Symbol, stream.Description, stream.Frequency, stream.SLAms, stream.Status, metaJSON, tenant, stream.CreatedAt, stream.UpdatedAt)
	if err != nil {
		return domainds.Stream{}, err
	}
	return stream, nil
}

func (s *Store) UpdateStream(ctx context.Context, stream domainds.Stream) (domainds.Stream, error) {
	existing, err := s.GetStream(ctx, stream.ID)
	if err != nil {
		return domainds.Stream{}, err
	}
	stream.CreatedAt = existing.CreatedAt
	stream.UpdatedAt = time.Now().UTC()

	metaJSON, err := json.Marshal(stream.Metadata)
	if err != nil {
		return domainds.Stream{}, err
	}
	tenant := s.accountTenant(ctx, stream.AccountID)

	result, err := s.db.ExecContext(ctx, `
		UPDATE chainlink_datastreams
		SET name = $2, symbol = $3, description = $4, frequency = $5, sla_ms = $6, status = $7, metadata = $8, tenant = $9, updated_at = $10
		WHERE id = $1
	`, stream.ID, stream.Name, stream.Symbol, stream.Description, stream.Frequency, stream.SLAms, stream.Status, metaJSON, tenant, stream.UpdatedAt)
	if err != nil {
		return domainds.Stream{}, err
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		return domainds.Stream{}, sql.ErrNoRows
	}
	return stream, nil
}

func (s *Store) GetStream(ctx context.Context, id string) (domainds.Stream, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, name, symbol, description, frequency, sla_ms, status, metadata, created_at, updated_at
		FROM chainlink_datastreams
		WHERE id = $1
	`, id)
	return scanDataStream(row)
}

func (s *Store) ListStreams(ctx context.Context, accountID string) ([]domainds.Stream, error) {
	tenant := s.accountTenant(ctx, accountID)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, name, symbol, description, frequency, sla_ms, status, metadata, created_at, updated_at
		FROM chainlink_datastreams
		WHERE account_id = $1 AND ($2 = '' OR tenant = $2)
		ORDER BY created_at DESC
	`, accountID, tenant)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var streams []domainds.Stream
	for rows.Next() {
		stream, err := scanDataStream(rows)
		if err != nil {
			return nil, err
		}
		streams = append(streams, stream)
	}
	return streams, rows.Err()
}

func (s *Store) CreateFrame(ctx context.Context, frame domainds.Frame) (domainds.Frame, error) {
	if frame.ID == "" {
		frame.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	frame.CreatedAt = now
	tenant := s.accountTenant(ctx, frame.AccountID)

	payloadJSON, err := json.Marshal(frame.Payload)
	if err != nil {
		return domainds.Frame{}, err
	}
	metaJSON, err := json.Marshal(frame.Metadata)
	if err != nil {
		return domainds.Frame{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO chainlink_datastream_frames
			(id, account_id, stream_id, sequence, payload, latency_ms, status, metadata, tenant, created_at, updated_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, frame.ID, frame.AccountID, frame.StreamID, frame.Sequence, payloadJSON, frame.LatencyMS, frame.Status, metaJSON, tenant, frame.CreatedAt, now)
	if err != nil {
		return domainds.Frame{}, err
	}
	return frame, nil
}

func (s *Store) ListFrames(ctx context.Context, streamID string, limit int) ([]domainds.Frame, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, account_id, stream_id, sequence, payload, latency_ms, status, metadata, created_at, updated_at
		FROM chainlink_datastream_frames
		WHERE stream_id = $1
		ORDER BY sequence DESC
		LIMIT $2
	`, streamID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var frames []domainds.Frame
	for rows.Next() {
		frame, err := scanDataStreamFrame(rows)
		if err != nil {
			return nil, err
		}
		frames = append(frames, frame)
	}
	return frames, rows.Err()
}

func (s *Store) GetLatestFrame(ctx context.Context, streamID string) (domainds.Frame, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, account_id, stream_id, sequence, payload, latency_ms, status, metadata, created_at, updated_at
		FROM chainlink_datastream_frames
		WHERE stream_id = $1
		ORDER BY sequence DESC
		LIMIT 1
	`, streamID)
	return scanDataStreamFrame(row)
}

func scanDataStream(scanner rowScanner) (domainds.Stream, error) {
	var (
		stream  domainds.Stream
		metaRaw []byte
	)
	if err := scanner.Scan(&stream.ID, &stream.AccountID, &stream.Name, &stream.Symbol, &stream.Description, &stream.Frequency, &stream.SLAms, &stream.Status, &metaRaw, &stream.CreatedAt, &stream.UpdatedAt); err != nil {
		return domainds.Stream{}, err
	}
	if len(metaRaw) > 0 {
		_ = json.Unmarshal(metaRaw, &stream.Metadata)
	}
	return stream, nil
}

func scanDataStreamFrame(scanner rowScanner) (domainds.Frame, error) {
	var (
		frame   domainds.Frame
		payload []byte
		metaRaw []byte
		updated time.Time
	)
	if err := scanner.Scan(&frame.ID, &frame.AccountID, &frame.StreamID, &frame.Sequence, &payload, &frame.LatencyMS, &frame.Status, &metaRaw, &frame.CreatedAt, &updated); err != nil {
		return domainds.Frame{}, err
	}
	if len(payload) > 0 {
		_ = json.Unmarshal(payload, &frame.Payload)
	}
	if len(metaRaw) > 0 {
		_ = json.Unmarshal(metaRaw, &frame.Metadata)
	}
	return frame, nil
}
