// Package nitro provides the service framework for AWS Nitro Nitros.
package nitro

import (
	"context"
	"fmt"
	"sync"

	"github.com/gorilla/mux"

	"github.com/r3e-network/neo-miniapp-platform/infrastructure/database"
)

// Service is a minimal base for Nitro-hosted services.
//
// Prefer embedding `infrastructure/service.BaseService` in actual services; it
// wraps this type and provides lifecycle hooks, workers, and standard routes.
type Service struct {
	mu sync.RWMutex

	// Identity
	id      string
	name    string
	version string

	// Dependencies
	nitro  *Nitro
	db     database.RepositoryInterface
	router *mux.Router

	// State
	running bool
}

// ServiceConfig holds service configuration.
type ServiceConfig struct {
	ID      string
	Name    string
	Version string
	Nitro   *Nitro
	DB      database.RepositoryInterface
}

// NewService creates a new base service.
func NewService(cfg ServiceConfig) *Service {
	return &Service{
		id:      cfg.ID,
		name:    cfg.Name,
		version: cfg.Version,
		nitro:   cfg.Nitro,
		db:      cfg.DB,
		router:  mux.NewRouter(),
	}
}

// ID returns the service ID.
func (s *Service) ID() string {
	return s.id
}

// Name returns the service name.
func (s *Service) Name() string {
	return s.name
}

// Version returns the service version.
func (s *Service) Version() string {
	return s.version
}

// Nitro returns the Nitro instance.
func (s *Service) Nitro() *Nitro {
	return s.nitro
}

// DB returns the database repository.
func (s *Service) DB() database.RepositoryInterface {
	return s.db
}

// Router returns the HTTP router.
func (s *Service) Router() *mux.Router {
	return s.router
}

// Start starts the service.
func (s *Service) Start(ctx context.Context) error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("service already running")
	}
	s.running = true
	s.mu.Unlock()

	return nil
}

// Stop stops the service.
func (s *Service) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return nil
	}

	s.running = false
	return nil
}

// IsRunning returns true if the service is running.
func (s *Service) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}
