package indexer

import (
	"context"
	"fmt"
	"sync"

	"github.com/sirupsen/logrus"
)

// Service is the main indexer service orchestrator.
type Service struct {
	cfg     *Config
	storage *Storage
	syncer  *Syncer
	tracer  *Tracer
	log     *logrus.Entry
	mu      sync.Mutex
	running bool
}

// NewService creates a new indexer service.
func NewService(cfg *Config) (*Service, error) {
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	storage, err := NewStorage(cfg)
	if err != nil {
		return nil, fmt.Errorf("create storage: %w", err)
	}

	syncer, err := NewSyncer(cfg, storage)
	if err != nil {
		storage.Close()
		return nil, fmt.Errorf("create syncer: %w", err)
	}

	return &Service{
		cfg:     cfg,
		storage: storage,
		syncer:  syncer,
		tracer:  NewTracer(storage),
		log:     logrus.WithField("component", "indexer-service"),
	}, nil
}

// Start starts the indexer service.
func (s *Service) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return fmt.Errorf("service already running")
	}

	s.log.WithField("networks", s.cfg.Networks).Info("starting indexer")

	if err := s.syncer.Start(ctx); err != nil {
		return fmt.Errorf("start syncer: %w", err)
	}

	s.running = true
	return nil
}

// Stop stops the indexer service.
func (s *Service) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return nil
	}

	s.log.Info("stopping indexer")
	s.syncer.Stop()
	s.storage.Close()
	s.running = false
	return nil
}

// GetStorage returns the storage instance.
func (s *Service) GetStorage() *Storage {
	return s.storage
}

// GetTracer returns the tracer instance.
func (s *Service) GetTracer() *Tracer {
	return s.tracer
}
