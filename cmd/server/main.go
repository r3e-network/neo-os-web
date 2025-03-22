package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/willtech-services/service_layer/internal/api"
	"github.com/willtech-services/service_layer/internal/config"
	"github.com/willtech-services/service_layer/pkg/logger"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	log := logger.New(cfg.Monitoring.Logging)
	log.Info("Starting Neo N3 Service Layer...")

	// Initialize API server
	server, err := api.NewServer(cfg, log)
	if err != nil {
		log.Fatalf("Failed to initialize server: %v", err)
	}

	// Start server in a goroutine
	go func() {
		address := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
		log.Infof("API server starting on %s", address)
		if err := server.Start(address); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shut down the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Create a deadline for server shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Info("Server exited properly")
}