package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"sync"
	"time"
)

type auditEntry struct {
	Time       time.Time `json:"time"`
	User       string    `json:"user"`
	Role       string    `json:"role"`
	Tenant     string    `json:"tenant"`
	Path       string    `json:"path"`
	Method     string    `json:"method"`
	Status     int       `json:"status"`
	RemoteAddr string    `json:"remote_addr,omitempty"`
	UserAgent  string    `json:"user_agent,omitempty"`
}

type auditLog struct {
	mu      sync.Mutex
	entries []auditEntry
	max     int
	sink    auditSink
}

type auditSink interface {
	Write(entry auditEntry) error
}

func newAuditLog(max int, sink auditSink) *auditLog {
	if max <= 0 {
		max = 200
	}
	return &auditLog{max: max, sink: sink}
}

func (l *auditLog) add(entry auditEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.entries = append(l.entries, entry)
	if len(l.entries) > l.max {
		l.entries = l.entries[len(l.entries)-l.max:]
	}
	if l.sink != nil {
		// Best-effort persistence; ignore errors to avoid impacting request flow.
		_ = l.sink.Write(entry)
	}
}

func (l *auditLog) list() []auditEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]auditEntry, len(l.entries))
	copy(out, l.entries)
	return out
}

func (l *auditLog) listLimit(limit int) []auditEntry {
	if limit <= 0 || limit > l.max {
		limit = l.max
	}
	all := l.list()
	if len(all) <= limit {
		return all
	}
	return all[len(all)-limit:]
}

// fileAuditSink appends audit entries as JSONL.
type fileAuditSink struct {
	mu   sync.Mutex
	file *os.File
}

func newFileAuditSink(path string) (*fileAuditSink, error) {
	if path == "" {
		return nil, nil
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o640)
	if err != nil {
		return nil, err
	}
	return &fileAuditSink{file: f}, nil
}

func (s *fileAuditSink) Write(entry auditEntry) error {
	if s == nil || s.file == nil {
		return nil
	}
	b, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err = s.file.Write(append(b, '\n'))
	return err
}

// postgresAuditSink writes audit entries to the http_audit_log table when Postgres is configured.
type postgresAuditSink struct {
	db *sql.DB
}

func newPostgresAuditSink(db *sql.DB) auditSink {
	if db == nil {
		return nil
	}
	return &postgresAuditSink{db: db}
}

func (s *postgresAuditSink) Write(entry auditEntry) error {
	if s == nil || s.db == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO http_audit_log
			(occurred_at, user_name, role_name, tenant, path, method, status, remote_addr, user_agent)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, entry.Time, entry.User, entry.Role, entry.Tenant, entry.Path, entry.Method, entry.Status, entry.RemoteAddr, entry.UserAgent)
	return err
}
