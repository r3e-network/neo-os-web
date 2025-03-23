package monitoring

import (
	"github.com/R3E-Network/service_layer/internal/config"
	"github.com/R3E-Network/service_layer/pkg/logger"
	"github.com/prometheus/client_golang/prometheus"
)

// Service provides a centralized way to manage monitoring components
type Service struct {
	config           *config.MonitoringConfig
	logger           *logger.Logger
	metricsCollector *MetricsCollector
	registry         *prometheus.Registry
}

// NewService creates a new monitoring service
func NewService(cfg *config.MonitoringConfig, log *logger.Logger) (*Service, error) {
	service := &Service{
		config: cfg,
		logger: log,
	}

	// Initialize Prometheus metrics collector if enabled
	if cfg.Prometheus.Enabled {
		collector, err := NewMetricsCollector(cfg, log)
		if err != nil {
			log.Warnf("Failed to initialize metrics collector: %v", err)
		} else {
			service.metricsCollector = collector
		}
	}

	return service, nil
}

// Start initializes and starts all monitoring components
func (s *Service) Start() error {
	s.logger.Info("Starting monitoring service")

	// Start metrics collector if initialized
	if s.metricsCollector != nil {
		if err := s.metricsCollector.Start(); err != nil {
			s.logger.Warnf("Failed to start metrics collector: %v", err)
		}
	}

	return nil
}

// Stop gracefully shuts down all monitoring components
func (s *Service) Stop() {
	s.logger.Info("Stopping monitoring service")

	// Stop metrics collector if initialized
	if s.metricsCollector != nil {
		s.metricsCollector.Stop()
	}
}

// Metrics provides access to the metrics collector
func (s *Service) Metrics() *MetricsCollector {
	return s.metricsCollector
}

// Registry returns the Prometheus registry for registering additional metrics
func (s *Service) Registry() *prometheus.Registry {
	return s.registry
}
